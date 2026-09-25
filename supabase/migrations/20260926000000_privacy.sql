-- ============================================================================
-- مذاكر — حق حذف البيانات (نظام حماية البيانات الشخصية): يحذف المستخدم كل
-- ما يخصه على الخادم بضغطة من الإعدادات، دون المساس ببيانات غيره.
-- ============================================================================
create or replace function public.delete_my_data()
returns json language plpgsql volatile security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  n_bookings int; n_checkins int; n_pages int; n_sessions int; n_channels int;
begin
  if me is null then raise exception 'not_signed_in'; end if;
  -- كطالب: حجوزاته وتحضيراته
  delete from bookings where student = me;           get diagnostics n_bookings = row_count;
  delete from checkins where device = me;            get diagnostics n_checkins = row_count;
  -- كعضو هيئة تدريس: صفحاته وجلساته وقنواته (وما يتبعها يُحذف تلقائياً)
  delete from office_hours_pages where owner = me;   get diagnostics n_pages = row_count;
  delete from attendance_sessions where owner = me;  get diagnostics n_sessions = row_count;
  delete from section_channels where owner = me;     get diagnostics n_channels = row_count;
  return json_build_object('bookings', n_bookings, 'checkins', n_checkins, 'pages', n_pages, 'sessions', n_sessions, 'channels', n_channels);
end $$;

revoke all on function public.delete_my_data() from public, anon;
grant execute on function public.delete_my_data() to authenticated;

-- تشديد صلاحيات الجداول الأقدم: الكتابة على الأعمدة المطلوبة فقط، فلا يختار أحد رمز الصفحة أو
-- رمز الجلسة أو صلاحيتها بنفسه (كانت ممنوحة على الجدول كاملاً في الهجرة الأولى).
revoke insert, update on public.office_hours_pages, public.attendance_sessions from authenticated;
grant insert (title, host_name, slot_minutes, is_open) on public.office_hours_pages to authenticated;
grant update (title, host_name, slot_minutes, is_open) on public.office_hours_pages to authenticated;
grant insert (label) on public.attendance_sessions to authenticated;
grant update (is_open) on public.attendance_sessions to authenticated;
