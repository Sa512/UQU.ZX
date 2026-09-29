-- ============================================================================
-- مذاكر 1.7: إصلاحات المراجعة الأمنية لحسابات الإصدار 1.6.
-- 1) لا نثق بإيميل لم يُؤكَّد: نقرأ الإيميل من auth.users ونشترط email_confirmed_at.
--    (لو عُطّل «Confirm email» خطأً في لوحة Supabase، كان يمكن تسجيل إيميل دكتور أو المشرف دون امتلاكه.)
-- 2) حد لطلبات إنشاء/تعديل الملف.
-- 3) الاسم في الحجز والتحضير يُؤخذ من الحساب لا مما يكتبه الطالب (يمنع الحجز أو التحضير باسم غيره).
-- 4) سجل إجراءات المشرف (من اعتمد أو رفض أو صدّر بيانات، ومتى).
-- ============================================================================

-- الإيميل المؤكَّد فقط، من جدول المستخدمين نفسه لا من رمز الدخول
create or replace function public.my_email() returns text
language sql stable security definer set search_path = public as $$
  select lower(u.email) from auth.users u where u.id = auth.uid() and u.email_confirmed_at is not null
$$;
revoke all on function public.my_email() from public, anon, authenticated;

-- الغلاف: حد الطلبات ثم التحقق من تأكيد الإيميل، ثم المنطق الأصلي (يُعاد تسميته)
alter function public.complete_profile(text, text, text) rename to _complete_profile;
revoke all on function public._complete_profile(text, text, text) from public, anon, authenticated;

create function public.complete_profile(p_name text, p_role text, p_university text default '')
returns json language plpgsql volatile security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'not_signed_in'; end if;
  perform throttle('profile', 20, interval '10 minutes');
  if public.my_email() is null then raise exception 'email_not_confirmed'; end if;
  return public._complete_profile(p_name, p_role, p_university);
end $$;
revoke all on function public.complete_profile(text, text, text) from public, anon;
grant execute on function public.complete_profile(text, text, text) to authenticated;

-- اسم صاحب الحساب إن وُجد، وإلا الاسم المكتوب (للتوافق مع الإصدارات الأقدم)
create or replace function public.account_name(p_fallback text) returns text
language sql stable security definer set search_path = public as $$
  select coalesce((select full_name from profiles where id = auth.uid()), p_fallback)
$$;
revoke all on function public.account_name(text) from public, anon, authenticated;

create or replace function public.book_office_hour(p_code text, p_starts_at timestamptz, p_name text, p_uni_id text, p_topic text default '')
returns json language plpgsql volatile security definer set search_path = public as $$
begin
  perform throttle('book', 10, interval '10 minutes');
  begin
    return json_build_object('id', _book_office_hour(p_code, p_starts_at, public.account_name(p_name), p_uni_id, p_topic));
  exception when others then
    return json_build_object('error', sqlerrm);
  end;
end $$;

create or replace function public.check_in(p_code text, p_nonce text, p_uni_id text, p_name text)
returns json language plpgsql volatile security definer set search_path = public as $$
begin
  perform throttle('checkin', 12, interval '1 minute');
  begin
    return _check_in(p_code, p_nonce, p_uni_id, public.account_name(p_name));
  exception when others then
    return json_build_object('error', sqlerrm);
  end;
end $$;

-- ---------------------------------------------------------------------------
-- سجل إجراءات المشرف
-- ---------------------------------------------------------------------------
create table public.admin_log (
  id bigint generated always as identity primary key,
  admin_email text not null,
  action text not null,
  target text not null default '',
  at timestamptz not null default now()
);
alter table public.admin_log enable row level security;
revoke all on public.admin_log from anon, authenticated;

create or replace function public.log_admin(p_action text, p_target text) returns void
language sql volatile security definer set search_path = public as $$
  insert into admin_log (admin_email, action, target) values (coalesce(public.my_email(), '?'), p_action, left(coalesce(p_target, ''), 200))
$$;
revoke all on function public.log_admin(text, text) from public, anon, authenticated;

-- الإجراءات تُسجَّل بعد نجاحها (الأصل يُعاد تسميته ويُغلَّف)
alter function public.admin_set_user(uuid, text, text) rename to _admin_set_user;
alter function public.admin_export() rename to _admin_export;
alter function public.admin_set_rule(text, text, text) rename to _admin_set_rule;
alter function public.admin_set_override(text, text, boolean, text) rename to _admin_set_override;
revoke all on function public._admin_set_user(uuid, text, text), public._admin_export(), public._admin_set_rule(text, text, text),
  public._admin_set_override(text, text, boolean, text) from public, anon, authenticated;

create function public.admin_set_user(p_id uuid, p_role text, p_status text)
returns json language plpgsql volatile security definer set search_path = public as $$
declare r json;
begin
  r := public._admin_set_user(p_id, p_role, p_status);
  perform public.log_admin('set_user:' || p_role || '/' || p_status, r ->> 'email');
  return r;
end $$;

create function public.admin_export() returns json language plpgsql volatile security definer set search_path = public as $$
declare r json;
begin
  r := public._admin_export();
  perform public.log_admin('export', json_array_length(r)::text || ' rows');
  return r;
end $$;

create function public.admin_set_rule(p_domain text, p_university text, p_kind text)
returns void language plpgsql volatile security definer set search_path = public as $$
begin
  perform public._admin_set_rule(p_domain, p_university, p_kind);
  perform public.log_admin(case when p_kind is null then 'rule_delete' else 'rule:' || p_kind end, lower(btrim(p_domain)));
end $$;

create function public.admin_set_override(p_email text, p_role text, p_admin boolean, p_note text default '')
returns void language plpgsql volatile security definer set search_path = public as $$
begin
  perform public._admin_set_override(p_email, p_role, p_admin, p_note);
  perform public.log_admin(case when p_role is null and not coalesce(p_admin, false) then 'override_delete' when p_admin then 'override:admin' else 'override:' || p_role end, lower(btrim(p_email)));
end $$;

create or replace function public.admin_log_recent(p_limit int default 50) returns json
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'not_allowed'; end if;
  return coalesce((select json_agg(l) from (select admin_email, action, target, at from admin_log order by id desc limit least(greatest(p_limit, 1), 200)) l), '[]'::json);
end $$;

revoke all on function public.admin_set_user(uuid, text, text), public.admin_export(), public.admin_set_rule(text, text, text),
  public.admin_set_override(text, text, boolean, text), public.admin_log_recent(int) from public, anon;
grant execute on function public.admin_set_user(uuid, text, text), public.admin_export(), public.admin_set_rule(text, text, text),
  public.admin_set_override(text, text, boolean, text), public.admin_log_recent(int) to authenticated;

-- التنظيف الدوري: سجل المشرف يبقى سنة
create or replace function public.cleanup_old_data()
returns void language sql volatile security definer set search_path = public as $$
  delete from attendance_sessions where created_at < now() - interval '30 days';
  delete from bookings where starts_at < now() - interval '90 days';
  delete from section_posts where created_at < now() - interval '180 days';
  delete from rate_limits where at < now() - interval '1 day';
  delete from admin_log where at < now() - interval '365 days';
$$;
revoke all on function public.cleanup_old_data() from public, anon, authenticated;
