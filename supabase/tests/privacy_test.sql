-- اختبار «احذف بياناتي»: يحذف بيانات المستخدم فقط ولا يمس غيره.
\set ON_ERROR_STOP 1
\set QUIET 1
\set p1 '00000000-0000-0000-0000-0000000000c1'
\set p2 '00000000-0000-0000-0000-0000000000c2'
\set s1 '00000000-0000-0000-0000-0000000000d1'

reset role;
delete from t.ctx;
set role authenticated;

-- دكتوران لكل منهما صفحة ساعات وقناة شعبة
select t.as_user(:'p1');
with p as (insert into office_hours_pages (title, host_name) values ('ساعات أ', 'د. أ') returning code) insert into t.ctx select 'code1', code from p;
insert into office_hours_windows (page_id, weekday, start_min, end_min) select id, extract(dow from now() at time zone 'Asia/Riyadh')::int, 0, 1440 from office_hours_pages;
insert into section_channels (course_name, instructor) values ('مادة أ', 'د. أ');
insert into attendance_sessions (label) values ('محاضرة أ');
select t.as_user(:'p2');
insert into office_hours_pages (title, host_name) values ('ساعات ب', 'د. ب');
insert into section_channels (course_name, instructor) values ('مادة ب', 'د. ب');

-- طالب يحجز عند الدكتور الأول
select t.as_user(:'s1');
select t.must(public.book_office_hour((select v from t.ctx where k = 'code1'), t.next_slot(extract(dow from now() at time zone 'Asia/Riyadh')::int, 600), 'طالب', '443000001', ''));

-- الطالب يحذف بياناته: حجزه فقط
do $$
declare r json;
begin
  r := public.delete_my_data();
  assert (r ->> 'bookings')::int = 1, 'student booking deleted';
  assert (r ->> 'channels')::int = 0 and (r ->> 'pages')::int = 0, 'student owns no pages';
end $$;

-- الدكتور الأول يحذف بياناته: صفحته وقناته وجلسته، والثاني يبقى كما هو
select t.as_user(:'p1');
do $$
declare r json;
begin
  r := public.delete_my_data();
  assert (r ->> 'pages')::int = 1 and (r ->> 'channels')::int = 1 and (r ->> 'sessions')::int = 1, 'owner data deleted';
end $$;
reset role;
do $$ begin
  assert (select count(*) from office_hours_pages where owner = '00000000-0000-0000-0000-0000000000c2') = 1, 'other professor page kept';
  assert (select count(*) from section_channels where owner = '00000000-0000-0000-0000-0000000000c2') = 1, 'other professor channel kept';
  assert (select count(*) from office_hours_pages where owner = '00000000-0000-0000-0000-0000000000c1') = 0, 'own page gone';
  assert (select count(*) from office_hours_windows w where not exists (select 1 from office_hours_pages p where p.id = w.page_id)) = 0, 'windows cascaded';
  assert (select count(*) from bookings where student = '00000000-0000-0000-0000-0000000000d1') = 0, 'student booking gone';
  assert (select count(*) from checkins) > 0, 'other students check-ins kept';
end $$;

-- غير المسجّل لا يستطيع
set role anon;
select t.as_user(null);
select t.expect_error('select public.delete_my_data()', 'permission denied');
reset role;
\echo ALL PRIVACY TESTS PASSED

-- الأعمدة المحمية في الجداول الأقدم
set role authenticated;
select t.as_user(:'p2');
select t.expect_error($q$insert into office_hours_pages (title, host_name, code) values ('x صفحة', 'د. ب', 'VANITY')$q$, 'permission denied');
select t.expect_error($q$update office_hours_pages set code = 'AAAAAA'$q$, 'permission denied');
select t.expect_error($q$insert into attendance_sessions (label, nonce) values ('محاضرة', 'ABCDEFGH')$q$, 'permission denied');
insert into attendance_sessions (label) values ('محاضرة ب');
select t.expect_error($q$update attendance_sessions set expires_at = now() + interval '10 years'$q$, 'permission denied');
update attendance_sessions set is_open = false;
update office_hours_pages set is_open = false, title = 'ساعات ب المحدثة';
reset role;
\echo ALL GRANT TESTS PASSED
