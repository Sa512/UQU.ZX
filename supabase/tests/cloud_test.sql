-- اختبارات خدمات السحابة. تُشغَّل بعد harness.sql والهجرة:
--   psql -v ON_ERROR_STOP=1 -f supabase/tests/harness.sql -f supabase/migrations/*.sql -f supabase/tests/cloud_test.sql
\set ON_ERROR_STOP 1
\set QUIET 1

-- أدوات اختبار (تُنشأ كمستخدم رئيسي)
create schema if not exists t;
grant usage on schema t to authenticated, anon;
create or replace function t.as_user(u text) returns void language sql as $$
  select set_config('request.jwt.claims', case when u is null then '' else json_build_object('sub', u)::text end, false);
$$;
-- موعد قادم في يوم أسبوع محدد ودقيقة محددة بتوقيت الرياض
create or replace function t.next_slot(dow int, minute int) returns timestamptz language sql as $$
  select ((date_trunc('day', now() at time zone 'Asia/Riyadh')
          + make_interval(days => ((dow - extract(dow from now() at time zone 'Asia/Riyadh')::int + 7) % 7) + 7)
          + make_interval(mins => minute)) at time zone 'Asia/Riyadh');
$$;
create or replace function t.expect_error(sql text, expected text) returns void language plpgsql as $$
declare
  failed boolean := false;
  msg text;
begin
  begin
    execute sql;
  exception when others then
    failed := true;
    msg := sqlerrm;
  end;
  -- يُرفع خارج كتلة الالتقاط حتى لا يبتلعه المعالج نفسه
  if not failed then
    raise exception 'EXPECTED ERROR [%] but statement succeeded: %', expected, sql;
  end if;
  if msg not like '%' || expected || '%' then
    raise exception 'EXPECTED [%] but got [%] for: %', expected, msg, sql;
  end if;
end $$;
grant execute on all functions in schema t to authenticated, anon;
create table t.ctx (k text primary key, v text);
grant all on t.ctx to authenticated;

\set prof   '00000000-0000-0000-0000-00000000000a'
\set sara   '00000000-0000-0000-0000-00000000000b'
\set noura  '00000000-0000-0000-0000-00000000000c'
\set rim    '00000000-0000-0000-0000-00000000000d'

set role authenticated;

-- ===== الدكتور ينشئ صفحة الساعات المكتبية (الإثنين 10:00–11:00، مواعيد 15 دقيقة) =====
select t.as_user(:'prof');
with p as (insert into office_hours_pages (title, host_name, slot_minutes) values ('ساعات د. سارة المكتبية', 'د. سارة', 15) returning id, code)
insert into t.ctx select 'page_id', id::text from p union all select 'code', code from p;
insert into office_hours_windows (page_id, weekday, start_min, end_min, location)
  select v::uuid, 1, 600, 660, 'مكتب 3-214' from t.ctx where k = 'page_id';
do $$ begin
  assert (select count(*) from office_hours_pages) = 1, 'owner sees own page';
  assert (select owner from office_hours_pages) = auth.uid(), 'owner defaults to caller';
  assert (select code from office_hours_pages) ~ '^[A-HJ-NP-Z2-9]{6}$', 'readable 6-char code';
end $$;

-- ===== سارة تحجز =====
select t.as_user(:'sara');
do $$
declare c text := (select v from t.ctx where k = 'code');
declare info json := public.get_office_hours(lower(c));  -- الرمز غير حساس لحالة الأحرف
begin
  assert info ->> 'host_name' = 'د. سارة', 'page info visible by code';
  assert json_array_length(info -> 'taken') = 0, 'nothing taken yet';
  assert (select count(*) from office_hours_pages) = 0, 'student cannot read pages table directly';
  perform public.book_office_hour(c, t.next_slot(1, 600), 'سارة محمد', '443001122', 'سؤال عن الواجب');
  perform public.book_office_hour(c, t.next_slot(1, 630), 'سارة محمد', '443001122');
  perform t.expect_error(format('select public.book_office_hour(%L, %L, %L, %L)', c, t.next_slot(1, 645), 'سارة محمد', '443001122'), 'too_many_bookings');
end $$;

-- ===== نورة: موعد محجوز، مواعيد غير صالحة، وقراءة حجوزات غيرها =====
select t.as_user(:'noura');
do $$
declare c text := (select v from t.ctx where k = 'code');
begin
  perform t.expect_error(format('select public.book_office_hour(%L, %L, %L, %L)', c, t.next_slot(1, 600), 'نورة علي', '443001133'), 'slot_taken');
  perform t.expect_error(format('select public.book_office_hour(%L, %L, %L, %L)', c, t.next_slot(1, 607), 'نورة علي', '443001133'), 'slot_invalid');
  perform t.expect_error(format('select public.book_office_hour(%L, %L, %L, %L)', c, t.next_slot(1, 660), 'نورة علي', '443001133'), 'slot_invalid');
  perform t.expect_error(format('select public.book_office_hour(%L, %L, %L, %L)', c, t.next_slot(2, 600), 'نورة علي', '443001133'), 'slot_invalid');
  perform t.expect_error(format('select public.book_office_hour(%L, %L, %L, %L)', c, now() - interval '1 day', 'نورة علي', '443001133'), 'slot_in_past');
  perform t.expect_error(format('select public.book_office_hour(%L, %L, %L, %L)', c, t.next_slot(1, 615), 'ن', '443001133'), 'check constraint');
  perform t.expect_error(format('select public.book_office_hour(%L, %L, %L, %L)', 'ZZZZZZ', t.next_slot(1, 615), 'نورة علي', ''), 'page_not_found');
  perform public.book_office_hour(c, t.next_slot(1, 615), 'نورة علي', '443001133');
  assert (select count(*) from bookings) = 1, 'student sees only own bookings';
  assert (select public.get_office_hours(c)::text) not like '%سارة محمد%', 'no student names leak through page info';
  assert json_array_length(public.get_office_hours(c) -> 'taken') = 3, 'taken slots listed';
  perform t.expect_error('insert into bookings (page_id, student, starts_at, ends_at, student_name) select page_id, auth.uid(), now() + interval ''3 days'', now() + interval ''3 days 15 minutes'', ''اختراق'' from bookings limit 1', 'permission denied');
  perform t.expect_error(format('select public.cancel_booking(%L)', (select id from bookings b where false)), 'not_allowed');
end $$;

-- نورة تحاول إلغاء حجز سارة (معرّفه تجلبه الاختبارات كمستخدم رئيسي)
reset role;
insert into t.ctx select 'sara_booking', id::text from bookings where student_name = 'سارة محمد' order by starts_at limit 1;
set role authenticated;
select t.as_user(:'noura');
select t.expect_error(format('select public.cancel_booking(%L)', (select v from t.ctx where k = 'sara_booking')), 'not_allowed');

-- ===== الدكتور يرى كل الحجوزات بالأسماء ويلغي واحداً =====
select t.as_user(:'prof');
do $$ begin
  assert (select count(*) from bookings where status = 'booked') = 3, 'owner sees all bookings on page';
  assert (select count(*) from bookings where student_name = 'نورة علي') = 1, 'owner sees names';
end $$;
select public.cancel_booking((select v::uuid from t.ctx where k = 'sara_booking'));

-- الموعد الملغى صار متاحاً لريم
select t.as_user(:'rim');
select public.book_office_hour((select v from t.ctx where k = 'code'), t.next_slot(1, 600), 'ريم خالد', '443001144');

-- ===== التحضير الذاتي =====
select t.as_user(:'prof');
with s as (insert into attendance_sessions (label) values ('هياكل البيانات · شعبة 1041') returning id, code, nonce)
insert into t.ctx select 'sid', id::text from s union all select 'scode', code from s union all select 'nonce1', nonce from s;

select t.as_user(:'sara');
do $$
declare c text := (select v from t.ctx where k = 'scode');
declare n text := (select v from t.ctx where k = 'nonce1');
begin
  perform t.expect_error(format('select public.check_in(%L, %L, %L, %L)', c, 'WRONG123', '443001122', 'سارة محمد'), 'qr_expired');
  perform public.check_in(c, n, '443001122', 'سارة محمد');
  perform t.expect_error(format('select public.check_in(%L, %L, %L, %L)', c, n, '443001199', 'سارة محمد'), 'already_checked_in');
  perform t.expect_error(format('select public.rotate_nonce(%L)', (select v from t.ctx where k = 'sid')), 'not_allowed');
  perform t.expect_error(format('select public.check_in(%L, %L, %L, %L)', c, n, 'abc', 'سارة'), 'check constraint');
  assert (select count(*) from attendance_sessions) = 0, 'student cannot read session secrets';
end $$;

-- نورة تستخدم رقم سارة الجامعي من جهازها
select t.as_user(:'noura');
select t.expect_error(format('select public.check_in(%L, %L, %L, %L)', (select v from t.ctx where k = 'scode'), (select v from t.ctx where k = 'nonce1'), '443001122', 'منتحل'), 'uni_id_used');

-- الدكتور يجدد الرمز: القديم يبقى مقبولاً لفترة قصيرة فقط
select t.as_user(:'prof');
insert into t.ctx select 'nonce2', public.rotate_nonce((select v::uuid from t.ctx where k = 'sid'));
select t.as_user(:'noura');
select public.check_in((select v from t.ctx where k = 'scode'), (select v from t.ctx where k = 'nonce1'), '443001133', 'نورة علي');

-- بعد 50 ثانية: الرمز القديم والحالي منتهيان (صورة أُرسلت لطالب غائب لا تعمل)
reset role;
update attendance_sessions set nonce_at = now() - interval '50 seconds';
set role authenticated;
select t.as_user(:'rim');
select t.expect_error(format('select public.check_in(%L, %L, %L, %L)', (select v from t.ctx where k = 'scode'), (select v from t.ctx where k = 'nonce2'), '443001144', 'ريم خالد'), 'qr_expired');
select t.expect_error(format('select public.check_in(%L, %L, %L, %L)', (select v from t.ctx where k = 'scode'), (select v from t.ctx where k = 'nonce1'), '443001144', 'ريم خالد'), 'qr_expired');

-- الدكتور يرى الحضور، والطالب يرى تحضيره فقط، والجلسة المغلقة ترفض
select t.as_user(:'prof');
do $$ begin
  assert (select count(*) from checkins) = 2, 'owner sees all check-ins';
end $$;
update attendance_sessions set is_open = false;
select t.as_user(:'noura');
do $$ begin
  assert (select count(*) from checkins) = 1, 'student sees own check-in only';
  perform t.expect_error(format('select public.check_in(%L, %L, %L, %L)', (select v from t.ctx where k = 'scode'), (select v from t.ctx where k = 'nonce2'), '443001155', 'هند'), 'session_closed');
end $$;

-- مستخدم غير مسجّل (anon) لا يستطيع شيئاً
reset role;
set role anon;
select t.as_user(null);
select t.expect_error(format('select public.get_office_hours(%L)', 'ABCDEF'), 'permission denied');
select t.expect_error('select * from bookings', 'permission denied');

reset role;
\echo ALL CLOUD TESTS PASSED
