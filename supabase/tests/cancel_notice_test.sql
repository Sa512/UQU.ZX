-- اختبارات 2.0: إلغاء الدكتور يُبلغ الطالب (مع السبب)، وإلغاء الطالب لا يُبلغ أحداً، وسجل الأعطال مجهول الهوية.
\set ON_ERROR_STOP 1
\set QUIET 1
\set cp  '00000000-0000-0000-0000-0000000000f1'
\set cs  '00000000-0000-0000-0000-0000000000f2'
\set cx  '00000000-0000-0000-0000-0000000000f3'

reset role;
delete from t.ctx;
set role authenticated;
select t.as_user(:'cp');
with p as (insert into office_hours_pages (title, host_name, slot_minutes) values ('ساعات د. سلمى', 'د. سلمى', 15) returning id, code)
insert into t.ctx select 'pid', id::text from p union all select 'code', code from p;
insert into office_hours_windows (page_id, weekday, start_min, end_min) select v::uuid, 3, 600, 720 from t.ctx where k = 'pid';

-- الطالب: لا يسجّل عنوان إشعار قبل أن يحجز
select t.as_user(:'cs');
do $$ begin assert public.register_student_push('ExponentPushToken[student1-abcdefghij]') ->> 'error' = 'not_allowed', 'no booking, no token'; end $$;
select t.must(public.book_office_hour((select v from t.ctx where k = 'code'), t.next_slot(3, 600), 'نوف العتيبي', '', ''));
select t.must(public.book_office_hour((select v from t.ctx where k = 'code'), t.next_slot(3, 615), 'نوف العتيبي', '', ''));
select t.must(public.register_student_push('ExponentPushToken[student1-abcdefghij]'));
select t.expect_error($q$select public.register_student_push('not-a-token')$q$, 'student_push_tokens_token_check');
select t.expect_error('select * from student_push_tokens', 'permission denied');
reset role;
insert into t.ctx select 'b1', id::text from bookings where student = '00000000-0000-0000-0000-0000000000f2' order by starts_at limit 1;
insert into t.ctx select 'b2', id::text from bookings where student = '00000000-0000-0000-0000-0000000000f2' order by starts_at desc limit 1;

-- طرف ثالث لا يلغي
set role authenticated;
select t.as_user(:'cx');
select t.expect_error(format('select public.cancel_booking(%L)', (select v from t.ctx where k = 'b1')), 'not_allowed');

-- الدكتور يلغي مع سبب (يُنظَّف ويُقصّ إلى 120 حرفاً)
select t.as_user(:'cp');
select public.cancel_booking((select v::uuid from t.ctx where k = 'b1'), E'  عندي   اجتماع\nقسم  ' || repeat('ـ', 200));
reset role;
do $$ declare b bookings := (select b from bookings b where id = (select v::uuid from t.ctx where k = 'b1'));
begin
  assert b.status = 'cancelled' and b.cancelled_by = 'host' and b.cancelled_at is not null, 'host cancel recorded: ' || row_to_json(b);
  assert b.cancel_note like 'عندي اجتماع قسم ـ%' and char_length(b.cancel_note) = 120, 'note cleaned: ' || b.cancel_note;
end $$;
-- لا يُلغى مرتين
set role authenticated;
select t.as_user(:'cp');
select t.expect_error(format('select public.cancel_booking(%L)', (select v from t.ctx where k = 'b1')), 'not_allowed');
-- الطالب يرى إلغاء الدكتور وسببه في حجوزاته
select t.as_user(:'cs');
do $$ begin
  assert (select cancelled_by from bookings where id = (select v::uuid from t.ctx where k = 'b1')) = 'host', 'student sees who cancelled';
end $$;
select t.expect_error(format('select public.cancel_push_targets(%L)', (select v from t.ctx where k = 'b1')), 'permission denied');

set role service_role;
do $$ declare j json := public.cancel_push_targets((select v::uuid from t.ctx where k = 'b1'));
begin
  assert j ->> 'host_name' = 'د. سلمى' and j ->> 'title' = 'ساعات د. سلمى', 'payload: ' || j;
  assert j ->> 'note' like 'عندي اجتماع%', 'note in payload';
  assert json_array_length(j -> 'tokens') = 1, 'student token: ' || j;
end $$;

-- الطالب يلغي الثاني بنفسه: سببه لا يُخزَّن ولا إشعار
reset role;
set role authenticated;
select t.as_user(:'cs');
select public.cancel_booking((select v::uuid from t.ctx where k = 'b2'), 'سبب خاص');
reset role;
do $$ begin
  assert (select cancelled_by = 'student' and cancel_note = '' from bookings where id = (select v::uuid from t.ctx where k = 'b2')), 'student cancel, no note';
end $$;
set role service_role;
do $$ begin assert public.cancel_push_targets((select v::uuid from t.ctx where k = 'b2')) is null, 'no push for own cancel'; end $$;
-- القائم لا يُرسل عنه
reset role;
set role authenticated;
select t.as_user(:'cs');
select t.must(public.book_office_hour((select v from t.ctx where k = 'code'), t.next_slot(3, 630), 'نوف العتيبي', '', ''));
reset role;
insert into t.ctx select 'b3', id::text from bookings where student = '00000000-0000-0000-0000-0000000000f2' and status = 'booked';
set role service_role;
do $$ begin assert public.cancel_push_targets((select v::uuid from t.ctx where k = 'b3')) is null, 'booked: no cancel push'; end $$;

-- العنوان الميت يُحذف من جدول الطلاب أيضاً
select public.drop_push_tokens(array['ExponentPushToken[student1-abcdefghij]']);
reset role;
do $$ begin assert (select count(*) from student_push_tokens) = 0, 'dead student token dropped'; end $$;

-- التنظيف: عنوان الطالب يُحذف بعد انتهاء مواعيده
insert into student_push_tokens (owner, token) values ('00000000-0000-0000-0000-0000000000f3', 'ExponentPushToken[orphan-abcdefghijk]'),
  ('00000000-0000-0000-0000-0000000000f2', 'ExponentPushToken[student2-abcdefghij]');
select public.cleanup_old_data();
do $$ begin
  assert (select array_agg(token) from student_push_tokens) = array['ExponentPushToken[student2-abcdefghij]'], 'orphan token cleaned, active kept';
end $$;

-- حذف البيانات يشمل عناوين الطالب
set role authenticated;
select t.as_user(:'cs');
do $$ begin assert (public.delete_my_data() ->> 'subscriptions')::int = 1, 'delete_my_data removes student tokens'; end $$;

-- ---------------------------------------------------------------------------
-- سجل الأعطال
-- ---------------------------------------------------------------------------
select t.must(public.report_error('2.0.0', 'ios', 'book', 'TypeError: x of a@b.edu.sa 4430011223 eyJhbGciOiJIUzI1NiIsInR5cCI6'));
do $$ begin assert public.report_error('2.0', 'ios', '', 'x') ->> 'error' like '%app_version%', 'version format'; end $$;
do $$ begin assert public.report_error('2.0.0', 'windows', '', 'x') ->> 'error' like '%platform%', 'platform'; end $$;
select t.expect_error('select * from client_errors', 'permission denied');
reset role;
do $$ declare e client_errors := (select e from client_errors e order by id limit 1);
begin
  assert e.message = 'TypeError: x of [email] [n] [token]', 'server-side scrub: ' || e.message;
  assert (select count(*) from information_schema.columns where table_name = 'client_errors' and column_name in ('uid', 'owner', 'user_id')) = 0, 'no user column';
end $$;
-- الحد: 10 في الساعة (المحاولتان الخاطئتان والأولى = 3)
set role authenticated;
select t.as_user(:'cs');
do $$ begin
  for i in 1..7 loop perform t.must(public.report_error('2.0.0', 'android', '', 'e' || i)); end loop;
end $$;
select t.expect_error($q$select public.report_error('2.0.0', 'android', '', 'e8')$q$, 'rate_limited');
-- للمشرف فقط
select t.expect_error('select public.admin_errors()', 'not_allowed');
reset role;
insert into t.ctx select 'adm', id::text from auth.users where email = 'asd1911147@gmail.com';
set role authenticated;
select t.as_email((select v from t.ctx where k = 'adm'), 'asd1911147@gmail.com');
do $$ declare j json := public.admin_errors();
begin
  assert json_array_length(j) = 8 and (j -> 0 ->> 'count')::int = 1, 'admin errors: ' || j;
  assert (public.admin_overview() ->> 'errors_week')::int = 8, 'overview counts errors';
end $$;
reset role;
delete from client_errors where at < now() + interval '1 day';
select 'ALL CANCEL NOTICE TESTS PASSED';
