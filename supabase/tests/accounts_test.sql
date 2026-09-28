-- اختبارات الحسابات: تصنيف الإيميل، والأدوار، ودليل الساعات المكتبية، ولوحة المشرف، وحذف الحساب.
\set ON_ERROR_STOP 1
\set QUIET 1
\set stu  '00000000-0000-0000-0000-0000000000c1'
\set dr   '00000000-0000-0000-0000-0000000000c2'
\set drx  '00000000-0000-0000-0000-0000000000c3'
\set adm  '00000000-0000-0000-0000-0000000000c4'
\set oth  '00000000-0000-0000-0000-0000000000c5'
\set rev  '00000000-0000-0000-0000-0000000000c6'
\set fake '00000000-0000-0000-0000-0000000000c7'
\set stx  '00000000-0000-0000-0000-0000000000c8'

reset role;
delete from t.ctx;
create or replace function t.as_email(u text, e text) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', u, 'email', e)::text, false);
$$;
grant execute on function t.as_email(text, text) to authenticated;
insert into auth.users (id, email) values
  (:'stu', 's441012345@st.uqu.edu.sa'), (:'dr', 'sm.harbi@uqu.edu.sa'), (:'drx', 'k.otaibi@newuni.edu.sa'),
  (:'adm', 'asd1911147@gmail.com'), (:'oth', 'n.qahtani@ksu.edu.sa'), (:'rev', 'review@example.com'), (:'fake', '441099999@uqu.edu.sa'), (:'stx', 'ali@st.newuni.edu.sa');

-- تصنيف الإيميل
do $$ begin
  assert public.email_kind('s441012345@st.uqu.edu.sa') ->> 'kind' = 'student', 'student subdomain';
  assert public.email_kind('s441012345@st.uqu.edu.sa') ->> 'university' = 'جامعة أم القرى', 'university from domain';
  assert public.email_kind('441012345@student.ksu.edu.sa') ->> 'kind' = 'student', 'ksu student';
  assert public.email_kind('441099999@uqu.edu.sa') ->> 'kind' = 'student', 'numeric id at base domain';
  assert public.email_kind('sm.harbi@uqu.edu.sa') ->> 'kind' = 'staff', 'staff';
  assert public.email_kind('Dr.Ali@CS.KSU.EDU.SA') ->> 'kind' = 'staff', 'department subdomain, case-insensitive';
  assert public.email_kind('k.otaibi@newuni.edu.sa') ->> 'kind' = 'unknown', 'unlisted university';
  assert public.email_kind('x@st.newuni.edu.sa') ->> 'kind' = 'student', 'unlisted student subdomain';
  assert public.email_kind('someone@gmail.com') ->> 'kind' = 'not_university', 'gmail';
  assert public.email_kind('evil@uqu.edu.sa.evil.com') ->> 'kind' = 'not_university', 'lookalike domain';
  assert public.email_kind('dr@fakeuqu.edu.sa') ->> 'kind' = 'unknown', 'lookalike prefix is not uqu';
  assert public.email_kind('a@b@uqu.edu.sa') ->> 'kind' = 'not_university', 'double at';
end $$;

set role authenticated;
-- لا وصول مباشر للجداول
select t.expect_error('select * from profiles', 'permission denied');
select t.expect_error('select * from domain_rules', 'permission denied');
select t.expect_error('select * from email_overrides', 'permission denied');

-- الطالب: يسجل كطالب، ولا يقدر يسجل كدكتور
select t.as_email(:'stu', 's441012345@st.uqu.edu.sa');
select t.expect_error($q$select public.complete_profile('نورة', 'professor')$q$, 'student_email');
do $$ declare j json := public.complete_profile(' نورة العتيبي ', 'student', 'أي جامعة');
begin assert j ->> 'role' = 'student' and j ->> 'status' = 'active' and j ->> 'full_name' = 'نورة العتيبي' and j ->> 'university' = 'جامعة أم القرى', 'student profile: ' || j; end $$;
select t.as_email(:'fake', '441099999@uqu.edu.sa'), (:'stx', 'ali@st.newuni.edu.sa');
select t.expect_error($q$select public.complete_profile('منتحل', 'professor')$q$, 'student_email');
select t.expect_error($q$select public.complete_profile('x', 'student')$q$, 'bad_name');
select t.expect_error($q$select public.complete_profile('سارة', 'admin')$q$, 'bad_role');

-- إيميل غير جامعي مرفوض
select t.as_email(:'rev', 'review@example.com');
select t.expect_error($q$select public.complete_profile('مراجع', 'student')$q$, 'not_university_email');

-- دكتور بإيميل منسوبين: مفعّل مباشرة
select t.as_email(:'dr', 'sm.harbi@uqu.edu.sa');
do $$ begin assert public.complete_profile('د. سارة الحربي', 'professor') ->> 'status' = 'active', 'staff professor active'; end $$;
with p as (insert into office_hours_pages (title, host_name, slot_minutes) values ('ساعاتي المكتبية', 'اسم مزيف', 15) returning code)
insert into t.ctx select 'page', code from p;

-- دكتور بجامعة غير معروفة: بانتظار الموافقة ولا يظهر
select t.as_email(:'drx', 'k.otaibi@newuni.edu.sa');
do $$ declare j json := public.complete_profile('د. خالد العتيبي', 'professor', 'جامعة جديدة');
begin assert j ->> 'status' = 'pending' and j ->> 'university' = 'جامعة جديدة', 'pending professor: ' || j; end $$;
insert into office_hours_pages (title, host_name, slot_minutes) values ('ساعات خالد', 'د. خالد', 15);

-- دكتور من جامعة أخرى
select t.as_email(:'oth', 'n.qahtani@ksu.edu.sa');
select public.complete_profile('د. نوف القحطاني', 'professor');
insert into office_hours_pages (title, host_name, slot_minutes) values ('ساعات نوف', 'د. نوف', 15);

-- الطالب يرى دكاترة جامعته المعتمدين فقط، بأسمائهم الحقيقية لا ما كُتب في الصفحة
select t.as_email(:'stu', 's441012345@st.uqu.edu.sa');
do $$ declare j json := public.list_office_hosts();
begin
  assert json_array_length(j) = 1, 'only own-university active professors: ' || j;
  assert j -> 0 ->> 'host_name' = 'د. سارة الحربي', 'profile name, not page host_name';
  assert j -> 0 ->> 'code' = (select v from t.ctx where k = 'page'), 'page code';
  assert json_array_length(public.list_office_hosts('سارة')) = 1 and json_array_length(public.list_office_hosts('فهد')) = 0, 'search';
  assert json_array_length(public.list_office_hosts('%')) = 1, 'wildcards are literal';
end $$;
-- طالب في نفس جامعة الدكتور المعلّق: لا يراه قبل الموافقة
select t.as_email(:'stx', 'ali@st.newuni.edu.sa');
select public.complete_profile('علي', 'student', 'جامعة جديدة');
do $$ begin assert json_array_length(public.list_office_hosts()) = 0, 'pending professor hidden from own university'; end $$;
-- الصفحة المغلقة تختفي
select t.as_email(:'dr', 'sm.harbi@uqu.edu.sa');
update office_hours_pages set is_open = false;
select t.as_email(:'stu', 's441012345@st.uqu.edu.sa');
do $$ begin assert json_array_length(public.list_office_hosts()) = 0, 'closed page hidden'; end $$;
select t.as_email(:'dr', 'sm.harbi@uqu.edu.sa');
update office_hours_pages set is_open = true;
-- بلا ملف: لا دليل
select t.as_email(:'rev', 'review@example.com');
select t.expect_error('select public.list_office_hosts()', 'no_profile');

-- غير المشرف لا يصل للوحة
select t.as_email(:'dr', 'sm.harbi@uqu.edu.sa');
select t.expect_error('select public.admin_overview()', 'not_allowed');
select t.expect_error('select public.admin_users()', 'not_allowed');
select t.expect_error('select public.admin_export()', 'not_allowed');
select t.expect_error(format('select public.admin_set_user(%L, %L, %L)', :'dr', 'professor', 'active'), 'not_allowed');
select t.expect_error($q$select public.admin_set_override('x@y.com', 'student', true)$q$, 'not_allowed');
select t.expect_error($q$select public.admin_set_rule('newuni.edu.sa', 'جامعة', 'staff')$q$, 'not_allowed');
do $$ begin assert not public.is_admin(), 'not admin'; end $$;

-- المشرف (إيميل شخصي مستثنى)
select t.as_email(:'adm', 'asd1911147@gmail.com');
do $$ declare j json := public.complete_profile('مالك التطبيق', 'student');
begin assert (j ->> 'is_admin')::boolean and j ->> 'status' = 'active', 'admin profile: ' || j; end $$;
do $$ declare o json := public.admin_overview();
begin assert (o ->> 'students')::int = 3 and (o ->> 'professors')::int = 2 and (o ->> 'pending')::int = 1, 'overview: ' || o; end $$;
do $$ declare u json := public.admin_users(p_status => 'pending');
begin assert json_array_length(u) = 1 and u -> 0 ->> 'email' = 'k.otaibi@newuni.edu.sa', 'pending list'; end $$;
do $$ begin assert json_array_length(public.admin_users('قحطاني')) = 1, 'search users'; end $$;
-- الموافقة على الدكتور المعلّق
select public.admin_set_user(:'drx', 'professor', 'active');
select t.as_email(:'stx', 'ali@st.newuni.edu.sa');
do $$ begin assert json_array_length(public.list_office_hosts()) = 1, 'approved professor now listed'; end $$;
select t.as_email(:'adm', 'asd1911147@gmail.com');
-- حساب مراجعة المتجر: استثناء كطالب
select public.admin_set_override('Review@Example.com', 'student', false, 'Apple review');
-- إضافة قاعدة لجامعة جديدة
select public.admin_set_rule('newuni.edu.sa', 'جامعة جديدة', 'staff');
do $$ begin
  assert json_array_length(public.admin_export()) = 6, 'export all profiles';
  assert public.admin_export() -> 0 ->> 'email' is not null, 'export has email';
  assert json_array_length(public.admin_rules() -> 'overrides') = 2, 'overrides';
  assert public.email_kind('k.otaibi@newuni.edu.sa') ->> 'kind' = 'staff', 'new rule applies';
end $$;
select t.expect_error($q$select public.admin_set_override('asd1911147@gmail.com', null, false)$q$, 'not_allowed');

-- المراجع يسجل كطالب فقط
select t.as_email(:'rev', 'review@example.com');
select t.expect_error($q$select public.complete_profile('مراجع', 'professor')$q$, 'role_locked');
do $$ begin assert public.complete_profile('Apple Review', 'student') ->> 'status' = 'active', 'reviewer ok'; end $$;

-- رفض دكتور: تُغلق صفحته، ولا يعود «بانتظار الموافقة» بإعادة التسجيل
select t.as_email(:'adm', 'asd1911147@gmail.com');
select public.admin_set_user(:'oth', 'professor', 'rejected');
select t.as_email(:'oth', 'n.qahtani@ksu.edu.sa');
do $$ begin
  assert public.complete_profile('د. نوف القحطاني', 'professor') ->> 'status' = 'rejected', 'stays rejected';
  assert not (select bool_or(is_open) from office_hours_pages), 'rejected pages closed (only own rows visible)';
end $$;
-- الدكتور المعتمد لا يفقد اعتماده بتحديث اسمه
select t.as_email(:'drx', 'k.otaibi@newuni.edu.sa');
do $$ begin assert public.complete_profile('د. خالد بن سعد', 'professor') ->> 'status' = 'active', 'approved stays active'; end $$;
-- ملفي
do $$ begin assert public.my_profile() ->> 'full_name' = 'د. خالد بن سعد', 'my_profile'; end $$;

-- حذف الحساب: الملف والمستخدم وبياناته
select t.as_email(:'stu', 's441012345@st.uqu.edu.sa');
select public.delete_my_account();
do $$ begin assert public.my_profile() is null, 'profile gone'; end $$;
reset role;
do $$ begin
  assert not exists (select 1 from auth.users where id = '00000000-0000-0000-0000-0000000000c1'), 'auth user deleted';
  assert (select count(*) from profiles) = 6, 'others untouched';
end $$;
select 'ALL ACCOUNT TESTS PASSED';
