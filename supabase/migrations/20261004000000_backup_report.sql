-- ============================================================================
-- مذاكر 2.1:
--  1) نسخة سحابية مشفّرة لكل حساب: تُشفَّر على الجوال بكلمة مرور لا تصلنا (AES-256-GCM)،
--     والخادم يرفض أي نسخة غير مشفّرة، فلا يستطيع أحد (ولا نحن) قراءتها.
--  2) تقرير شهري للمشرف بأرقام النمو والاستخدام.
-- ============================================================================

create table public.user_backups (
  owner uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  -- الصيغة الوحيدة المقبولة: ملف مشفّر كما يصدّره التطبيق (لا نص واضح أبداً)
  blob text not null check (
    char_length(blob) <= 8000000 and
    blob ~ '^\{"app":"mudhaker","encrypted":\{"v":1,"kdf":"pbkdf2-sha256","iter":[0-9]{5,7},"salt":"[0-9a-f]{32}","iv":"[0-9a-f]{24}","ct":"[0-9a-f]{34,}"\}\}$'
  ),
  device text not null default '' check (device in ('', 'iPhone', 'iPad', 'Android', 'web')),
  updated_at timestamptz not null default now()
);
alter table public.user_backups enable row level security;
revoke all on public.user_backups from anon, authenticated;

-- حفظ النسخة (تستبدل السابقة): 30 مرة في الساعة تكفي النسخ التلقائي واليدوي
create or replace function public.save_backup(p_blob text, p_device text default '')
returns json language plpgsql volatile security definer set search_path = public as $$
declare t timestamptz;
begin
  perform throttle('backup', 30, interval '1 hour');
  begin
    insert into user_backups (blob, device) values (p_blob, coalesce(p_device, ''))
    on conflict (owner) do update set blob = excluded.blob, device = excluded.device, updated_at = now()
    returning updated_at into t;
    return json_build_object('ok', true, 'updated_at', t, 'size', char_length(p_blob));
  exception when check_violation then
    return json_build_object('error', 'bad_backup');
  when others then
    return json_build_object('error', sqlerrm);
  end;
end $$;

-- معلومات النسخة دون محتواها (لعرض «آخر نسخة» واقتراح الاستعادة)
create or replace function public.backup_info()
returns json language sql stable security definer set search_path = public as $$
  select json_build_object('updated_at', updated_at, 'size', char_length(blob), 'device', device)
  from user_backups where owner = auth.uid();
$$;

-- تنزيل النسخة المشفّرة (كبيرة الحجم: 20 مرة في الساعة)
create or replace function public.get_backup()
returns json language plpgsql volatile security definer set search_path = public as $$
begin
  perform throttle('backup_get', 20, interval '1 hour');
  return (select json_build_object('blob', blob, 'updated_at', updated_at) from user_backups where owner = auth.uid());
end $$;

create or replace function public.delete_backup()
returns void language sql volatile security definer set search_path = public as $$
  delete from user_backups where owner = auth.uid();
$$;

revoke all on function public.save_backup(text, text), public.backup_info(), public.get_backup(), public.delete_backup() from public, anon;
grant execute on function public.save_backup(text, text), public.backup_info(), public.get_backup(), public.delete_backup() to authenticated;

-- حذف البيانات يشمل النسخة السحابية
create or replace function public.delete_my_data()
returns json language plpgsql volatile security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  n_bookings int; n_checkins int; n_pages int; n_sessions int; n_channels int; n_subs int; n_host int; n_student int; n_backup int;
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
  delete from user_backups where owner = me;             get diagnostics n_backup = row_count;
  return json_build_object('bookings', n_bookings, 'checkins', n_checkins, 'subscriptions', n_subs + n_host + n_student, 'pages', n_pages,
    'sessions', n_sessions, 'channels', n_channels, 'backups', n_backup);
end $$;
revoke all on function public.delete_my_data() from public, anon;
grant execute on function public.delete_my_data() to authenticated;

-- النسخة المهجورة (لم تتحدث سنة كاملة) تُحذف
create or replace function public.cleanup_old_data()
returns void language sql volatile security definer set search_path = public as $$
  delete from attendance_sessions where created_at < now() - interval '30 days';
  delete from bookings where starts_at < now() - interval '90 days';
  delete from section_posts where created_at < now() - interval '180 days';
  delete from rate_limits where at < now() - interval '1 day';
  delete from admin_log where at < now() - interval '365 days';
  delete from client_errors where at < now() - interval '30 days';
  delete from student_push_tokens t where not exists
    (select 1 from bookings b where b.student = t.owner and b.status = 'booked' and b.starts_at > now() - interval '1 day');
  delete from user_backups where updated_at < now() - interval '365 days';
$$;
revoke all on function public.cleanup_old_data() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- التقرير الشهري للمشرف (الشهر بتوقيت الرياض)
-- ---------------------------------------------------------------------------
create or replace function public.admin_report(p_month date)
returns json language plpgsql volatile security definer set search_path = public as $$
declare
  s timestamptz := (date_trunc('month', p_month)::timestamp at time zone 'Asia/Riyadh');
  e timestamptz := ((date_trunc('month', p_month) + interval '1 month')::timestamp at time zone 'Asia/Riyadh');
  r json;
begin
  if not public.is_admin() then raise exception 'not_allowed'; end if;
  r := json_build_object(
    'month', to_char(date_trunc('month', p_month), 'YYYY-MM'),
    'new_students', (select count(*) from profiles where role = 'student' and created_at >= s and created_at < e),
    'new_professors', (select count(*) from profiles where role = 'professor' and created_at >= s and created_at < e),
    'total_users', (select count(*) from profiles where created_at < e),
    'active_users', (select count(*) from profiles where last_seen_at >= s and created_at < e),
    'bookings', (select count(*) from bookings where created_at >= s and created_at < e),
    'cancelled_by_host', (select count(*) from bookings where cancelled_by = 'host' and cancelled_at >= s and cancelled_at < e),
    'cancelled_by_student', (select count(*) from bookings where cancelled_by = 'student' and cancelled_at >= s and cancelled_at < e),
    'checkins', (select count(*) from checkins where at >= s and at < e),
    'posts', (select count(*) from section_posts where created_at >= s and created_at < e),
    'backups', (select count(*) from user_backups where updated_at >= s and updated_at < e),
    'errors', (select count(*) from client_errors where at >= s and at < e),
    'universities', coalesce((select json_agg(u) from (
      select university, count(*) as users from profiles where created_at >= s and created_at < e
      group by university order by count(*) desc limit 10) u), '[]'::json),
    'weeks', coalesce((select json_agg(w order by w.week) from (
      select to_char(date_trunc('week', created_at at time zone 'Asia/Riyadh'), 'YYYY-MM-DD') as week, count(*) as signups
      from profiles where created_at >= s and created_at < e group by 1) w), '[]'::json)
  );
  perform log_admin('report', to_char(date_trunc('month', p_month), 'YYYY-MM'));
  return r;
end $$;
revoke all on function public.admin_report(date) from public, anon;
grant execute on function public.admin_report(date) to authenticated;
