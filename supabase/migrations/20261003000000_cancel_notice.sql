-- ============================================================================
-- مذاكر 2.0:
--  1) إلغاء الدكتور للموعد يصل للطالب فوراً (إشعار + سبب اختياري)، ولا يبقى موعداً «قائماً» في جواله.
--  2) سجل أعطال مجهول الهوية: نص الخطأ بعد تنقيته على الجهاز، بلا معرّف مستخدم، يُحذف بعد 30 يوماً.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- من ألغى الموعد ولماذا
-- ---------------------------------------------------------------------------
alter table public.bookings
  add column cancelled_by text check (cancelled_by in ('student', 'host')),
  add column cancel_note text not null default '' check (char_length(cancel_note) <= 120),
  add column cancelled_at timestamptz;

-- التوقيع الجديد بسبب اختياري؛ الاستدعاء القديم {p_id} يبقى يعمل
drop function public.cancel_booking(uuid);
create function public.cancel_booking(p_id uuid, p_note text default '')
returns void language plpgsql volatile security definer set search_path = public as $$
declare b bookings;
begin
  select * into b from bookings where id = p_id and status = 'booked' for update;
  if not found then raise exception 'not_allowed'; end if;
  if exists (select 1 from office_hours_pages p where p.id = b.page_id and p.owner = auth.uid()) then
    update bookings set status = 'cancelled', cancelled_by = 'host', cancelled_at = now(),
      cancel_note = left(regexp_replace(btrim(coalesce(p_note, '')), '\s+', ' ', 'g'), 120)
    where id = p_id;
  elsif b.student = auth.uid() then
    -- سبب الطالب لا يُخزَّن (لا حاجة له، وأقل بيانات)
    update bookings set status = 'cancelled', cancelled_by = 'student', cancelled_at = now() where id = p_id;
  else
    raise exception 'not_allowed';
  end if;
end $$;
revoke all on function public.cancel_booking(uuid, text) from public, anon;
grant execute on function public.cancel_booking(uuid, text) to authenticated;

-- ---------------------------------------------------------------------------
-- عناوين إشعارات الطالب (لإبلاغه بإلغاء موعده فقط)
-- ---------------------------------------------------------------------------
create table public.student_push_tokens (
  owner uuid not null default auth.uid(),
  token text not null check (token ~ '^Expo(nent)?PushToken\[[A-Za-z0-9_-]{10,80}\]$'),
  created_at timestamptz not null default clock_timestamp(),
  primary key (owner, token)
);
alter table public.student_push_tokens enable row level security;
revoke all on public.student_push_tokens from anon, authenticated;

create or replace function public.register_student_push(p_token text)
returns json language plpgsql volatile security definer set search_path = public as $$
begin
  perform throttle('student_push', 20, interval '1 hour');
  begin
    -- فقط من عنده موعد قائم قادم
    if not exists (select 1 from bookings where student = auth.uid() and status = 'booked' and starts_at > now()) then
      raise exception 'not_allowed';
    end if;
    insert into student_push_tokens (token) values (btrim(p_token)) on conflict do nothing;
    delete from student_push_tokens where owner = auth.uid() and token not in
      (select token from student_push_tokens where owner = auth.uid() order by created_at desc limit 5);
    return json_build_object('ok', true);
  exception when others then
    return json_build_object('error', sqlerrm);
  end;
end $$;

create or replace function public.unregister_student_push(p_token text)
returns void language sql volatile security definer set search_path = public as $$
  delete from student_push_tokens where owner = auth.uid() and token = btrim(p_token)
$$;
revoke all on function public.register_student_push(text), public.unregister_student_push(text) from public, anon;
grant execute on function public.register_student_push(text), public.unregister_student_push(text) to authenticated;

-- لدالة الخادم فقط: إشعار الطالب بإلغاء الدكتور (لا يُرسل إن ألغى الطالب بنفسه، ولا لموعد مضى)
create or replace function public.cancel_push_targets(p_booking uuid)
returns json language sql stable security definer set search_path = public as $$
  select json_build_object(
    'title', p.title,
    'host_name', coalesce((select pr.full_name from profiles pr where pr.id = p.owner), p.host_name),
    'starts_at', b.starts_at, 'note', b.cancel_note,
    'tokens', coalesce((select json_agg(t.token) from student_push_tokens t where t.owner = b.student), '[]'::json)
  )
  from bookings b join office_hours_pages p on p.id = b.page_id
  where b.id = p_booking and b.status = 'cancelled' and b.cancelled_by = 'host' and b.starts_at > now();
$$;
revoke all on function public.cancel_push_targets(uuid) from public, anon, authenticated;

create or replace function public.drop_push_tokens(p_tokens text[])
returns void language sql volatile security definer set search_path = public as $$
  delete from channel_subscribers where token = any(p_tokens);
  delete from host_push_tokens where token = any(p_tokens);
  delete from student_push_tokens where token = any(p_tokens);
$$;
revoke all on function public.drop_push_tokens(text[]) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- سجل الأعطال (مجهول الهوية)
-- ---------------------------------------------------------------------------
create table public.client_errors (
  id bigserial primary key,
  at timestamptz not null default now(),
  app_version text not null check (app_version ~ '^[0-9]{1,2}\.[0-9]{1,2}\.[0-9]{1,3}$'),
  platform text not null check (platform in ('ios', 'android', 'web')),
  screen text not null default '' check (char_length(screen) <= 80),
  message text not null check (char_length(message) between 1 and 300)
);
alter table public.client_errors enable row level security;
revoke all on public.client_errors from anon, authenticated;

-- لا يُخزَّن معرّف المستخدم مع الخطأ؛ الحد يمنع الإغراق (10 في الساعة لكل حساب)
create or replace function public.report_error(p_version text, p_platform text, p_screen text, p_message text)
returns json language plpgsql volatile security definer set search_path = public as $$
begin
  perform throttle('error_report', 10, interval '1 hour');
  begin
    insert into client_errors (app_version, platform, screen, message)
    values (btrim(p_version), p_platform, left(btrim(coalesce(p_screen, '')), 80),
      -- تنقية احتياطية على الخادم: إيميلات وأرقام طويلة ورموز
      left(regexp_replace(regexp_replace(regexp_replace(btrim(p_message),
        '[^\s@]+@[^\s@]+', '[email]', 'g'),
        '[0-9]{4,}', '[n]', 'g'),
        '[A-Za-z0-9_-]{24,}', '[token]', 'g'), 300));
    return json_build_object('ok', true);
  exception when others then
    return json_build_object('error', sqlerrm);
  end;
end $$;
revoke all on function public.report_error(text, text, text, text) from public, anon;
grant execute on function public.report_error(text, text, text, text) to authenticated;

-- للمشرف: الأعطال الأكثر تكراراً آخر 7 أيام
create or replace function public.admin_errors()
returns json language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'not_allowed'; end if;
  return coalesce((select json_agg(e) from (
    select message, screen, max(app_version) as app_version, count(*) as count, max(at) as last_at
    from client_errors where at > now() - interval '7 days'
    group by message, screen order by count(*) desc, max(at) desc limit 50) e), '[]'::json);
end $$;
revoke all on function public.admin_errors() from public, anon;
grant execute on function public.admin_errors() to authenticated;

create or replace function public.admin_overview() returns json language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'not_allowed'; end if;
  return json_build_object(
    'students', (select count(*) from profiles where role = 'student'),
    'professors', (select count(*) from profiles where role = 'professor' and status = 'active'),
    'pending', (select count(*) from profiles where role = 'professor' and status = 'pending'),
    'new_week', (select count(*) from profiles where created_at > now() - interval '7 days'),
    'active_week', (select count(*) from profiles where last_seen_at > now() - interval '7 days'),
    'open_pages', (select count(*) from office_hours_pages where is_open),
    'bookings_week', (select count(*) from bookings where created_at > now() - interval '7 days'),
    'errors_week', (select count(*) from client_errors where at > now() - interval '7 days'),
    'universities', coalesce((select json_agg(u) from (select university, count(*) as users from profiles group by university order by count(*) desc limit 10) u), '[]'::json)
  );
end $$;

do $$ begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant execute on function public.cancel_push_targets(uuid), public.drop_push_tokens(text[]) to service_role;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- حذف البيانات والتنظيف الدوري
-- ---------------------------------------------------------------------------
create or replace function public.delete_my_data()
returns json language plpgsql volatile security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  n_bookings int; n_checkins int; n_pages int; n_sessions int; n_channels int; n_subs int; n_host int; n_student int;
begin
  if me is null then raise exception 'not_signed_in'; end if;
  delete from bookings where student = me;               get diagnostics n_bookings = row_count;
  delete from checkins where device = me;                get diagnostics n_checkins = row_count;
  delete from channel_subscribers where subscriber = me; get diagnostics n_subs = row_count;
  delete from host_push_tokens where owner = me;         get diagnostics n_host = row_count;
  delete from student_push_tokens where owner = me;      get diagnostics n_student = row_count;
  delete from office_hours_pages where owner = me;       get diagnostics n_pages = row_count;
  delete from attendance_sessions where owner = me;      get diagnostics n_sessions = row_count;
  delete from section_channels where owner = me;         get diagnostics n_channels = row_count;
  return json_build_object('bookings', n_bookings, 'checkins', n_checkins, 'subscriptions', n_subs + n_host + n_student, 'pages', n_pages, 'sessions', n_sessions, 'channels', n_channels);
end $$;
revoke all on function public.delete_my_data() from public, anon;
grant execute on function public.delete_my_data() to authenticated;

create or replace function public.cleanup_old_data()
returns void language sql volatile security definer set search_path = public as $$
  delete from attendance_sessions where created_at < now() - interval '30 days';
  delete from bookings where starts_at < now() - interval '90 days';
  delete from section_posts where created_at < now() - interval '180 days';
  delete from rate_limits where at < now() - interval '1 day';
  delete from admin_log where at < now() - interval '365 days';
  delete from client_errors where at < now() - interval '30 days';
  -- عنوان إشعار الطالب لا يبقى بعد آخر مواعيده
  delete from student_push_tokens t where not exists
    (select 1 from bookings b where b.student = t.owner and b.status = 'booked' and b.starts_at > now() - interval '1 day');
$$;
revoke all on function public.cleanup_old_data() from public, anon, authenticated;
