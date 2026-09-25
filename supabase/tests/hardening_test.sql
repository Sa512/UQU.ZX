-- اختبارات تقوية 1.4: حدود الطلبات، ونافذة رمز التحضير الأقصر، وحماية الدوال الأصلية.
\set ON_ERROR_STOP 1
\set QUIET 1
\set prof '00000000-0000-0000-0000-0000000000e1'
\set u1   '00000000-0000-0000-0000-0000000000f1'
\set u2   '00000000-0000-0000-0000-0000000000f2'
\set u3   '00000000-0000-0000-0000-0000000000f3'
\set u4   '00000000-0000-0000-0000-0000000000f4'
\set u5   '00000000-0000-0000-0000-0000000000f5'

reset role;
delete from t.ctx;
set role authenticated;

-- ===== حد القراءة بالرمز: 30 في الدقيقة لكل مستخدم =====
select t.as_user(:'u1');
do $$ begin
  for i in 1..30 loop perform public.get_section('ZZZZZZ'); end loop;
end $$;
select t.expect_error($q$select public.get_office_hours('ZZZZZZ')$q$, 'rate_limited');
select t.expect_error($q$select public.get_section('ZZZZZZ')$q$, 'rate_limited');
-- مستخدم آخر غير متأثر
select t.as_user(:'u2');
select public.get_section('ZZZZZZ');

-- لا أحد يستدعي الأصل أو الحارس مباشرة
select t.expect_error($q$select public._get_section('ZZZZZZ')$q$, 'permission denied');
select t.expect_error($q$select public._get_office_hours('ZZZZZZ')$q$, 'permission denied');
select t.expect_error($q$select public._book_office_hour('ZZZZZZ', now(), 'x', '', '')$q$, 'permission denied');
select t.expect_error($q$select public.throttle('lookup', 1000, interval '1 second')$q$, 'permission denied');
select t.expect_error($q$select * from rate_limits$q$, 'permission denied');

-- ===== حد الحجز: 10 كل 10 دقائق =====
select t.as_user(:'u3');
do $$ begin
  for i in 1..10 loop perform t.expect_error($q$select public.book_office_hour('ZZZZZZ', now() + interval '1 day', 'طالب', '', '')$q$, 'page_not_found'); end loop;
end $$;
select t.expect_error($q$select public.book_office_hour('ZZZZZZ', now() + interval '1 day', 'طالب', '', '')$q$, 'rate_limited');

-- ===== نافذة رمز التحضير =====
select t.as_user(:'prof');
with s as (insert into attendance_sessions (label) values ('نافذة') returning id, code, nonce)
insert into t.ctx select 'sid', id::text from s union all select 'scode', code from s union all select 'n1', nonce from s;
insert into t.ctx select 'n2', public.rotate_nonce((select v::uuid from t.ctx where k = 'sid'));

-- الحالي بعد 19 ثانية مقبول، وبعد 21 مرفوض
reset role; update attendance_sessions set nonce_at = now() - interval '19 seconds' where label = 'نافذة'; set role authenticated;
select t.as_user(:'u4');
select t.must(public.check_in((select v from t.ctx where k = 'scode'), lower((select v from t.ctx where k = 'n2')), '443009001', 'طالب أ'));
reset role; update attendance_sessions set nonce_at = now() - interval '21 seconds' where label = 'نافذة'; set role authenticated;
select t.as_user(:'u5');
select t.expect_error(format('select public.check_in(%L, %L, %L, %L)', (select v from t.ctx where k = 'scode'), (select v from t.ctx where k = 'n2'), '443009002', 'طالب ب'), 'qr_expired');

-- السابق: مقبول خلال 5 ثوانٍ من التجديد فقط (كان 45)
reset role; update attendance_sessions set nonce_at = now() - interval '4 seconds' where label = 'نافذة'; set role authenticated;
select t.must(public.check_in((select v from t.ctx where k = 'scode'), (select v from t.ctx where k = 'n1'), '443009002', 'طالب ب'));
reset role; update attendance_sessions set nonce_at = now() - interval '6 seconds' where label = 'نافذة'; set role authenticated;
select t.as_user(:'u1');
select t.expect_error(format('select public.check_in(%L, %L, %L, %L)', (select v from t.ctx where k = 'scode'), (select v from t.ctx where k = 'n1'), '443009003', 'طالب ج'), 'qr_expired');

-- ===== حد التحضير: 12 في الدقيقة =====
select t.as_user(:'u2');
do $$ begin
  for i in 1..12 loop perform t.expect_error($q$select public.check_in('ZZZZZZ', 'AAAAAAAA', '443000000', 'طالب')$q$, 'session_not_found'); end loop;
end $$;
select t.expect_error($q$select public.check_in('ZZZZZZ', 'AAAAAAAA', '443000000', 'طالب')$q$, 'rate_limited');

-- التنظيف يحذف السجلات القديمة
reset role;
update rate_limits set at = now() - interval '2 days';
select public.cleanup_old_data();
do $$ begin assert (select count(*) from rate_limits) = 0, 'old attempts cleaned'; end $$;
\echo ALL HARDENING TESTS PASSED
