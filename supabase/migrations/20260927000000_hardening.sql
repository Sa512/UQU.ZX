-- ============================================================================
-- مذاكر 1.4 — تقوية الأمان بعد المراجعة الشاملة:
-- 1) حدود للطلبات لكل مستخدم (ضد تخمين الرموز والإغراق الآلي).
-- 2) نافذة أقصر لرمز التحضير: الرمز صالح نحو 20 ثانية فقط من ظهوره (كان نحو 60)،
--    فيصعب تصويره وإرساله لزميل غائب.
-- الدوال الأصلية تبقى كما هي خلف «حارس» يفحص الحد أولاً، ولا يستدعيها أحد مباشرة.
-- ============================================================================

create table public.rate_limits (
  bucket text not null,
  uid uuid not null,
  at timestamptz not null default now()
);
create index rate_limits_lookup on public.rate_limits (uid, bucket, at);
alter table public.rate_limits enable row level security;
revoke all on public.rate_limits from anon, authenticated;

-- يسجّل محاولة ويرفض إن تجاوز المستخدم الحد خلال النافذة
create or replace function public.throttle(p_bucket text, p_max int, p_window interval)
returns void language plpgsql volatile security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'not_signed_in'; end if;
  if (select count(*) from rate_limits where uid = auth.uid() and bucket = p_bucket and at > now() - p_window) >= p_max then
    raise exception 'rate_limited';
  end if;
  insert into rate_limits (bucket, uid) values (p_bucket, auth.uid());
end $$;
revoke all on function public.throttle(text, int, interval) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- حراس الدوال: الأصل يُعاد تسميته ويُسحب من المستخدمين، ويحل محله حارس بنفس الاسم
-- ---------------------------------------------------------------------------
alter function public.get_office_hours(text) rename to _get_office_hours;
alter function public.book_office_hour(text, timestamptz, text, text, text) rename to _book_office_hour;
alter function public.get_section(text) rename to _get_section;
revoke all on function public._get_office_hours(text), public._book_office_hour(text, timestamptz, text, text, text), public._get_section(text)
  from public, anon, authenticated;

-- قراءة صفحة أو قناة بالرمز: 30 محاولة في الدقيقة (تكفي أي استخدام طبيعي، وتجعل التخمين مستحيلاً عملياً)
create or replace function public.get_office_hours(p_code text)
returns json language plpgsql volatile security definer set search_path = public as $$
begin
  perform throttle('lookup', 30, interval '1 minute');
  return _get_office_hours(p_code);
end $$;

create or replace function public.get_section(p_code text)
returns json language plpgsql volatile security definer set search_path = public as $$
begin
  perform throttle('lookup', 30, interval '1 minute');
  return _get_section(p_code);
end $$;

-- الحجز: 10 محاولات كل 10 دقائق.
-- مهم: لو رفع الحارس الخطأ لتراجعت قاعدة البيانات عن تسجيل المحاولة نفسها، فلا تُحسب المحاولات الفاشلة
-- (وهي بالضبط شكل التخمين). لذلك يلتقط الحارس الخطأ ويعيده قيمةً {error}، فتبقى المحاولة محسوبة.
create function public.book_office_hour(p_code text, p_starts_at timestamptz, p_name text, p_uni_id text, p_topic text default '')
returns json language plpgsql volatile security definer set search_path = public as $$
begin
  perform throttle('book', 10, interval '10 minutes');
  begin
    return json_build_object('id', _book_office_hour(p_code, p_starts_at, p_name, p_uni_id, p_topic));
  exception when others then
    return json_build_object('error', sqlerrm);
  end;
end $$;

-- منطق التحضير بنافذة أقصر للرمز (خلف الحارس)
create or replace function public._check_in(p_code text, p_nonce text, p_uni_id text, p_name text)
returns json language plpgsql volatile security definer set search_path = public as $$
declare
  s attendance_sessions;
  ok boolean;
begin
  if auth.uid() is null then raise exception 'not_signed_in'; end if;
  select * into s from attendance_sessions where code = upper(trim(p_code));
  if not found then raise exception 'session_not_found'; end if;
  if not s.is_open or s.expires_at <= now() then raise exception 'session_closed'; end if;
  -- الرمز الحالي صالح 20 ثانية من تجديده (يتجدد كل 15)، والسابق 5 ثوانٍ فقط بعد التجديد لتأخر الشبكة.
  -- coalesce ضروري: nonce_prev يكون NULL في أول جلسة، والمقارنة معه تعطي NULL لا false.
  ok := coalesce(upper(trim(p_nonce)) = s.nonce and now() - s.nonce_at <= interval '20 seconds', false)
     or coalesce(upper(trim(p_nonce)) = s.nonce_prev and now() - s.nonce_at <= interval '5 seconds', false);
  if not ok then raise exception 'qr_expired'; end if;
  begin
    insert into checkins (session_id, device, uni_id, student_name) values (s.id, auth.uid(), trim(p_uni_id), trim(p_name));
  exception when unique_violation then
    if exists (select 1 from checkins c where c.session_id = s.id and c.device = auth.uid()) then
      raise exception 'already_checked_in';
    end if;
    raise exception 'uni_id_used';
  end;
  return json_build_object('label', s.label, 'at', now());
end $$;

revoke all on function public._check_in(text, text, text, text) from public, anon, authenticated;

-- التحضير: 12 محاولة في الدقيقة (الأخطاء تُعاد قيمةً لتبقى المحاولة محسوبة)
create or replace function public.check_in(p_code text, p_nonce text, p_uni_id text, p_name text)
returns json language plpgsql volatile security definer set search_path = public as $$
begin
  perform throttle('checkin', 12, interval '1 minute');
  begin
    return _check_in(p_code, p_nonce, p_uni_id, p_name);
  exception when others then
    return json_build_object('error', sqlerrm);
  end;
end $$;

revoke all on function public.get_office_hours(text), public.get_section(text), public.book_office_hour(text, timestamptz, text, text, text),
  public.check_in(text, text, text, text) from public, anon;
grant execute on function public.get_office_hours(text), public.get_section(text), public.book_office_hour(text, timestamptz, text, text, text),
  public.check_in(text, text, text, text) to authenticated;

-- التنظيف الدوري يشمل سجل المحاولات
create or replace function public.cleanup_old_data()
returns void language sql volatile security definer set search_path = public as $$
  delete from attendance_sessions where created_at < now() - interval '30 days';
  delete from bookings where starts_at < now() - interval '90 days';
  delete from section_posts where created_at < now() - interval '180 days';
  delete from rate_limits where at < now() - interval '1 day';
$$;
revoke all on function public.cleanup_old_data() from public, anon, authenticated;
