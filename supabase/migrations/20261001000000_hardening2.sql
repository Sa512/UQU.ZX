-- ============================================================================
-- مذاكر 1.8: تقوية إضافية قبل الإطلاق.
-- 1) email_kind لا تُستدعى دون حساب (كانت متاحة لـ anon ولا يحتاجها التطبيق؛ يصنّف الإيميل محلياً).
-- 2) حد لتصدير المشرف: 10 مرات في الساعة (لو سُرق حساب مشرف لا يُسحب كل شيء مراراً دون أثر).
-- 3) حد لقراءة قائمة المستخدمين في اللوحة: 120 طلباً في الدقيقة.
-- 4) الدكتور المرفوض لا ينشئ صفحة حجز ولا قناة شعبة جديدة.
-- ============================================================================

revoke execute on function public.email_kind(text) from anon;

alter function public.admin_export() rename to _admin_export_logged;
revoke all on function public._admin_export_logged() from public, anon, authenticated;
create function public.admin_export() returns json language plpgsql volatile security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'not_allowed'; end if;
  perform throttle('admin_export', 10, interval '1 hour');
  return public._admin_export_logged();
end $$;
revoke all on function public.admin_export() from public, anon;
grant execute on function public.admin_export() to authenticated;

alter function public.admin_users(text, text, text, int, int) rename to _admin_users;
revoke all on function public._admin_users(text, text, text, int, int) from public, anon, authenticated;
create function public.admin_users(p_query text default '', p_role text default null, p_status text default null, p_limit int default 50, p_offset int default 0)
returns json language plpgsql volatile security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'not_allowed'; end if;
  perform throttle('admin_users', 120, interval '1 minute');
  return public._admin_users(p_query, p_role, p_status, p_limit, p_offset);
end $$;
revoke all on function public.admin_users(text, text, text, int, int) from public, anon;
grant execute on function public.admin_users(text, text, text, int, int) to authenticated;

-- الدكتور المرفوض لا ينشر قناة شعبة جديدة (منع استغلال الصفة بعد الرفض)؛ الطلاب وغير المسجلين كما كانوا
create or replace function public.not_rejected() returns boolean language sql stable security definer set search_path = public as $$
  select not exists (select 1 from profiles where id = auth.uid() and role = 'professor' and status = 'rejected')
$$;
revoke all on function public.not_rejected() from public, anon;
grant execute on function public.not_rejected() to authenticated;
create policy channels_not_rejected on public.section_channels as restrictive for insert to authenticated with check (public.not_rejected());
create policy pages_not_rejected on public.office_hours_pages as restrictive for insert to authenticated with check (public.not_rejected());
