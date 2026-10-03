-- اختبارات 2.1: النسخة السحابية مشفّرة فقط وخاصة بصاحبها، والتقرير الشهري للمشرف فقط.
\set ON_ERROR_STOP 1
\set QUIET 1
\set ua  '00000000-0000-0000-0000-0000000000a1'
\set ub  '00000000-0000-0000-0000-0000000000a2'

reset role;
delete from t.ctx;
insert into auth.users (id, email) values (:'ua', 'bk.a@st.uqu.edu.sa'), (:'ub', 'bk.b@st.uqu.edu.sa');
-- ملف مشفّر صالح الشكل (كما يصدّره التطبيق)
insert into t.ctx values ('enc', '{"app":"mudhaker","encrypted":{"v":1,"kdf":"pbkdf2-sha256","iter":150000,"salt":"' || repeat('ab', 16) || '","iv":"' || repeat('cd', 12) || '","ct":"' || repeat('0f', 40) || '"}}');

set role authenticated;
select t.as_user(:'ua');
do $$ begin assert public.backup_info() is null, 'no backup yet'; end $$;
-- نص واضح أو ملف معدّل يُرفض
do $$ begin
  assert public.save_backup('{"app":"mudhaker","version":1,"data":{"students":[]}}') ->> 'error' = 'bad_backup', 'plaintext rejected';
  assert public.save_backup(replace((select v from t.ctx where k = 'enc'), '"iv":"', '"iv":"zz')) ->> 'error' = 'bad_backup', 'malformed iv rejected';
  assert public.save_backup(replace((select v from t.ctx where k = 'enc'), repeat('cd', 12), repeat('zz', 12))) ->> 'error' = 'bad_backup', 'non-hex iv rejected';
  assert public.save_backup((select v from t.ctx where k = 'enc') || ' ') ->> 'error' = 'bad_backup', 'trailing junk rejected';
  assert public.save_backup((select v from t.ctx where k = 'enc'), 'Windows') ->> 'error' = 'bad_backup', 'unknown device rejected';
end $$;
select t.must(public.save_backup((select v from t.ctx where k = 'enc'), 'iPad'));
do $$ declare i json := public.backup_info();
begin
  assert i ->> 'device' = 'iPad' and (i ->> 'size')::int = char_length((select v from t.ctx where k = 'enc')), 'info: ' || i;
  assert i::text not like '%"ct"%', 'info has no content';
  assert public.get_backup() ->> 'blob' = (select v from t.ctx where k = 'enc'), 'owner downloads own backup';
end $$;
-- تحديث يستبدل (نسخة واحدة لكل حساب)
select t.must(public.save_backup(replace((select v from t.ctx where k = 'enc'), repeat('0f', 40), repeat('1e', 40)), 'iPhone'));
reset role;
do $$ begin assert (select count(*) from user_backups) = 1, 'one backup per account'; end $$;
set role authenticated;

-- حساب آخر لا يرى ولا يحذف نسخة غيره
select t.as_user(:'ub');
do $$ begin
  assert public.backup_info() is null and public.get_backup() is null, 'other user sees nothing';
end $$;
select public.delete_backup();
select t.expect_error('select * from user_backups', 'permission denied');
reset role;
do $$ begin assert (select count(*) from user_backups) = 1, 'still there'; end $$;
set role authenticated;

-- حد التنزيل: 20 في الساعة (استُخدمت واحدة للحساب الثاني)
do $$ begin for i in 1..19 loop perform public.get_backup(); end loop; end $$;
select t.expect_error('select public.get_backup()', 'rate_limited');

-- حذف البيانات يشمل النسخة
select t.as_user(:'ua');
do $$ begin
  assert (public.delete_my_data() ->> 'backups')::int = 1, 'delete_my_data reports backup';
  assert public.backup_info() is null, 'delete_my_data removes backup';
end $$;
select t.must(public.save_backup((select v from t.ctx where k = 'enc')));
-- حذف الحساب يحذف النسخة بالتتابع
reset role;
delete from auth.users where id = :'ua';
do $$ begin assert (select count(*) from user_backups) = 0, 'account deletion cascades'; end $$;
-- النسخة المهجورة سنة تُحذف
insert into user_backups (owner, blob, updated_at) values (:'ub', (select v from t.ctx where k = 'enc'), now() - interval '366 days');
select public.cleanup_old_data();
do $$ begin assert (select count(*) from user_backups) = 0, 'stale backup cleaned'; end $$;

-- ---------------------------------------------------------------------------
-- التقرير الشهري
-- ---------------------------------------------------------------------------
set role authenticated;
select t.as_user(:'ub');
select t.expect_error('select public.admin_report(current_date)', 'not_allowed');
reset role;
insert into t.ctx select 'adm', id::text from auth.users where email = 'asd1911147@gmail.com';
-- حساب أُنشئ الشهر الماضي لا يُحسب في هذا الشهر
insert into auth.users (id, email) values ('00000000-0000-0000-0000-0000000000a3', 'old@st.uqu.edu.sa');
insert into profiles (id, email, full_name, university, role, status, created_at)
  values ('00000000-0000-0000-0000-0000000000a3', 'old@st.uqu.edu.sa', 'قديم', 'جامعة أم القرى', 'student', 'active', date_trunc('month', now()) - interval '10 days');
-- إلغاء من طالب هذا الشهر (حتى يتميّز عن إلغاء الدكتور)
insert into bookings (page_id, student, starts_at, ends_at, student_name, status, cancelled_by, cancelled_at)
  select id, '00000000-0000-0000-0000-0000000000a3', now() + interval '2 days', now() + interval '2 days 15 minutes', 'قديم', 'cancelled', 'student', now()
  from office_hours_pages limit 1;
insert into t.ctx select 'host_month', count(*)::text from bookings where cancelled_by = 'host'
  and cancelled_at >= (date_trunc('month', now() at time zone 'Asia/Riyadh') at time zone 'Asia/Riyadh');
insert into t.ctx select 'stu_month', count(*)::text from bookings where cancelled_by = 'student'
  and cancelled_at >= (date_trunc('month', now() at time zone 'Asia/Riyadh') at time zone 'Asia/Riyadh');
insert into t.ctx select 'n_month', count(*)::text from profiles where role = 'student'
  and created_at >= (date_trunc('month', now() at time zone 'Asia/Riyadh') at time zone 'Asia/Riyadh');
set role authenticated;
select t.as_email((select v from t.ctx where k = 'adm'), 'asd1911147@gmail.com');
do $$ declare r json := public.admin_report((now() at time zone 'Asia/Riyadh')::date);
begin
  assert r ->> 'month' = to_char(now() at time zone 'Asia/Riyadh', 'YYYY-MM'), 'month: ' || r;
  assert (r ->> 'new_students')::int = (select v::int from t.ctx where k = 'n_month'), 'students this month: ' || r;
  assert (r ->> 'cancelled_by_host')::int = (select v::int from t.ctx where k = 'host_month') and (r ->> 'cancelled_by_host')::int >= 1, 'host cancellations only: ' || r;
  assert (r ->> 'cancelled_by_student')::int = (select v::int from t.ctx where k = 'stu_month'), 'student cancellations: ' || r;
  assert (r ->> 'cancelled_by_student')::int >= 1, 'has a student cancellation';
  assert json_array_length(r -> 'weeks') >= 1, 'weekly series';
  assert r::text not like '%@%', 'no emails in the report';
end $$;
do $$ begin
  assert (public.admin_report(((now() at time zone 'Asia/Riyadh') - interval '1 month')::date) ->> 'new_students')::int >= 1, 'previous month has the old account';
end $$;
reset role;
do $$ begin assert (select action from admin_log order by id desc limit 1) = 'report', 'report access logged'; end $$;
select 'ALL BACKUP REPORT TESTS PASSED';
