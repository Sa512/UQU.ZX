-- اختبارات إصلاحات المراجعة الأمنية 1.7: الإيميل غير المؤكد، والاسم من الحساب، وسجل المشرف، وحد الطلبات.
\set ON_ERROR_STOP 1
\set QUIET 1
\set unc  '00000000-0000-0000-0000-0000000000d1'
\set drs  '00000000-0000-0000-0000-0000000000d2'
\set sts  '00000000-0000-0000-0000-0000000000d3'
\set adm2 '00000000-0000-0000-0000-0000000000d4'

reset role;
delete from t.ctx;
-- إيميل دكتور غير مؤكَّد (كأن «Confirm email» عُطّل بالخطأ) + إيميل المشرف غير مؤكد
insert into auth.users (id, email, email_confirmed_at) values
  (:'unc', 'victim.prof@uqu.edu.sa', null), (:'adm2', 'someone-else@gmail.com', null),
  (:'drs', 'f.zahrani@uqu.edu.sa', now()), (:'sts', 's442000111@st.uqu.edu.sa', now());

set role authenticated;
-- رمز الدخول يدّعي إيميلاً مؤكداً لكن الخادم يقرأ من auth.users
select t.as_email(:'unc', 'victim.prof@uqu.edu.sa');
select t.expect_error($q$select public.complete_profile('منتحل', 'professor')$q$, 'email_not_confirmed');
select t.as_email(:'sts', 'asd1911147@gmail.com'); -- ادعاء إيميل المشرف في الرمز لا يفيد
do $$ begin assert (public.complete_profile('طالب', 'student') ->> 'is_admin')::boolean = false, 'jwt email claim ignored'; end $$;
do $$ begin assert public.my_profile() ->> 'email' = 's442000111@st.uqu.edu.sa', 'email from auth.users'; end $$;
select t.expect_error($q$select public.my_email()$q$, 'permission denied');
select t.expect_error($q$select public._complete_profile('x', 'student', '')$q$, 'permission denied');
select t.expect_error($q$select public._admin_export()$q$, 'permission denied');

-- الاسم في الحجز والتحضير من الحساب لا مما يُكتب
select t.as_email(:'drs', 'f.zahrani@uqu.edu.sa');
select public.complete_profile('د. فهد الزهراني', 'professor');
with p as (insert into office_hours_pages (title, host_name, slot_minutes) values ('ساعات', 'د. فهد', 15) returning id, code)
insert into t.ctx select 'pid', id::text from p union all select 'pcode', code from p;
insert into office_hours_windows (page_id, weekday, start_min, end_min) select v::uuid, 1, 600, 660 from t.ctx where k = 'pid';
with s as (insert into attendance_sessions (label) values ('هياكل') returning id, code, nonce)
insert into t.ctx select 'scode', code from s union all select 'nonce', nonce from s union all select 'sid', id::text from s;
select t.as_email(:'sts', 's442000111@st.uqu.edu.sa');
select t.must(public.book_office_hour((select v from t.ctx where k = 'pcode'), t.next_slot(1, 600), 'اسم مزيف', '442000111', ''));
select t.must(public.check_in((select v from t.ctx where k = 'scode'), (select v from t.ctx where k = 'nonce'), '442000111', 'اسم مزيف'));
reset role;
do $$ begin
  assert (select student_name from bookings order by created_at desc limit 1) = 'طالب', 'booking uses account name';
  assert (select student_name from checkins order by at desc limit 1) = 'طالب', 'check-in uses account name';
end $$;

-- حد طلبات الملف: 20 كل 10 دقائق
set role authenticated;
select t.as_email(:'sts', 's442000111@st.uqu.edu.sa');
do $$ begin for i in 1..19 loop perform public.complete_profile('طالب', 'student'); end loop; end $$;
select t.expect_error($q$select public.complete_profile('طالب', 'student')$q$, 'rate_limited');

-- سجل المشرف: يُسجَّل كل إجراء، ولا يقرؤه غير المشرف
select t.expect_error('select public.admin_log_recent()', 'not_allowed');
select t.expect_error('select * from admin_log', 'permission denied');
reset role;
delete from admin_log; -- يبدأ السجل فارغاً لهذا الاختبار (مجموعة الحسابات قبله سجّلت إجراءاتها)
set role authenticated;
select t.as_email(:'adm', 'asd1911147@gmail.com');
select public.admin_set_user(:'drs', 'professor', 'rejected');
select public.admin_export();
select public.admin_set_rule('test.edu.sa', 'جامعة اختبار', 'staff');
select public.admin_set_rule('test.edu.sa', 'جامعة اختبار', null);
select public.admin_set_override('reviewer2@example.com', 'student', false, '');
do $$ declare l json := public.admin_log_recent();
begin
  assert json_array_length(l) = 5, 'five actions logged: ' || l;
  assert l -> 0 ->> 'action' = 'override:student' and l -> 0 ->> 'admin_email' = 'asd1911147@gmail.com', 'latest first, by admin';
  assert l -> 4 ->> 'action' = 'set_user:professor/rejected' and l -> 4 ->> 'target' = 'f.zahrani@uqu.edu.sa', 'set_user logged with target';
  assert (select count(*) from json_array_elements(l) e where e ->> 'action' = 'export') = 1, 'export logged';
end $$;
select 'ALL SECURITY TESTS PASSED';
