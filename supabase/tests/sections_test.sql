-- اختبارات «قناة الشعبة». تُشغَّل بعد cloud_test.sql (تستخدم أدوات المخطط t).
\set ON_ERROR_STOP 1
\set QUIET 1

\set prof   '00000000-0000-0000-0000-0000000000a1'
\set prof2  '00000000-0000-0000-0000-0000000000a2'
\set stu    '00000000-0000-0000-0000-0000000000b1'

reset role;
delete from t.ctx;
set role authenticated;

-- ===== الدكتور ينشئ قناة لشعبته =====
select t.as_user(:'prof');
with c as (
  insert into section_channels (course_name, course_code, section_code, instructor, color, slots, exams)
  values ('هياكل البيانات', 'CS 2301', '1041', 'د. سارة الحربي', '#4F46E5',
          '[{"weekday":0,"start_min":480,"end_min":580,"type":"lecture","location":"مبنى 5"}]',
          '[{"title":"الاختبار الفصلي الأول","date":"2026-10-20","type":"exam"}]')
  returning id, code, updated_at)
insert into t.ctx select 'cid', id::text from c union all select 'code', code from c union all select 'u0', updated_at::text from c;
do $$ begin
  assert (select owner from section_channels) = auth.uid(), 'owner defaults to caller';
  assert (select code from section_channels) ~ '^[A-HJ-NP-Z2-9]{6}$', 'readable 6-char code';
end $$;

-- لا يختار الرمز أو المالك بنفسه، ولا يغيّرهما لاحقاً
select t.expect_error($q$insert into section_channels (course_name, instructor, code) values ('مادة', 'د. س', 'VANITY')$q$, 'permission denied');
select t.expect_error($q$insert into section_channels (course_name, instructor, owner) values ('مادة', 'د. س', '00000000-0000-0000-0000-0000000000a2')$q$, 'permission denied');
select t.expect_error($q$update section_channels set code = 'AAAAAA'$q$, 'permission denied');
select t.expect_error($q$update section_channels set owner = '00000000-0000-0000-0000-0000000000a2'$q$, 'permission denied');

-- حدود الحجم
select t.expect_error($q$insert into section_channels (course_name, instructor, slots) select 'مادة', 'د. س', jsonb_agg(jsonb_build_object('weekday', 0)) from generate_series(1, 21)$q$, 'section_channels_slots_check');
select t.expect_error($q$insert into section_channels (course_name, instructor, slots) values ('مادة', 'د. س', '{"weekday":0}')$q$, 'section_channels_slots_check');
select t.expect_error($q$insert into section_channels (course_name, instructor, color) values ('مادة', 'د. س', 'red; drop')$q$, 'section_channels_color_check');

-- إعلان من الدكتور يحدّث وقت آخر تحديث
select pg_sleep(0.01);
insert into section_posts (channel_id, body) select v::uuid, 'الاختبار الفصلي تأجّل للأسبوع القادم' from t.ctx where k = 'cid';
do $$ begin
  assert (select updated_at from section_channels) > (select v::timestamptz from t.ctx where k = 'u0'), 'post bumps updated_at';
end $$;
select t.expect_error(format('insert into section_posts (channel_id, body) values (%L, %L)', (select v from t.ctx where k = 'cid'), '   '), 'section_posts_body_check');
select t.expect_error(format('insert into section_posts (channel_id, body) values (%L, %L)', (select v from t.ctx where k = 'cid'), repeat('ا', 501)), 'section_posts_body_check');
select t.expect_error(format('insert into section_posts (channel_id, body, created_at) values (%L, %L, %L)', (select v from t.ctx where k = 'cid'), 'قديم', '2020-01-01'), 'permission denied');

-- ===== الطالب يقرأ القناة بالرمز فقط =====
select t.as_user(:'stu');
do $$
declare j json;
begin
  j := public.get_section(lower(' ' || (select v from t.ctx where k = 'code') || ' '));
  assert j is not null, 'code is case/space-insensitive';
  assert j ->> 'course_name' = 'هياكل البيانات', 'course name';
  assert j -> 'owner' is null, 'owner id is never exposed';
  assert json_array_length(j -> 'posts') = 1, 'one post';
  assert json_array_length(j -> 'slots') = 1 and json_array_length(j -> 'exams') = 1, 'schedule and exams';
  assert public.get_section('ZZZZZZ') is null, 'unknown code';
  -- لا يرى الجداول مباشرة ولا يكتب فيها
  assert (select count(*) from section_channels) = 0, 'student cannot list channels';
  assert (select count(*) from section_posts) = 0, 'student cannot list posts';
end $$;
select t.expect_error(format('insert into section_posts (channel_id, body) values (%L, %L)', (select v from t.ctx where k = 'cid'), 'سبام'), 'row-level security');
update section_channels set course_name = 'مخترق';
delete from section_channels;
do $$ begin
  assert public.get_section((select v from t.ctx where k = 'code')) ->> 'course_name' = 'هياكل البيانات', 'student cannot edit or delete';
end $$;

-- ===== دكتور آخر لا يصل لقناة غيره =====
select t.as_user(:'prof2');
select t.expect_error(format('insert into section_posts (channel_id, body) values (%L, %L)', (select v from t.ctx where k = 'cid'), 'ليس لي'), 'row-level security');
do $$ begin
  assert (select count(*) from section_channels) = 0, 'other owner sees nothing';
end $$;

-- ===== حد الإعلانات اليومي و«آخر 20» =====
select t.as_user(:'prof');
insert into section_posts (channel_id, body) select (select v::uuid from t.ctx where k = 'cid'), 'إعلان ' || g from generate_series(2, 20) g;
select t.expect_error(format('insert into section_posts (channel_id, body) values (%L, %L)', (select v from t.ctx where k = 'cid'), 'الحادي والعشرون'), 'too_many_posts');
-- إعلانات الأمس لا تُحسب في حد اليوم، والطالب يرى آخر 20 فقط بالأحدث أولاً
reset role;
update section_posts set created_at = now() - interval '2 days' where body = 'الاختبار الفصلي تأجّل للأسبوع القادم';
set role authenticated;
select t.as_user(:'prof');
insert into section_posts (channel_id, body) select v::uuid, 'الأحدث' from t.ctx where k = 'cid';
select t.as_user(:'stu');
do $$
declare j json;
begin
  j := public.get_section((select v from t.ctx where k = 'code'));
  assert json_array_length(j -> 'posts') = 20, 'only the latest 20 posts';
  assert (j -> 'posts' -> 0 ->> 'body') = 'الأحدث', 'newest first';
end $$;

-- ===== حذف القناة يحذف إعلاناتها =====
select t.as_user(:'prof');
delete from section_channels;
reset role;
do $$ begin
  assert (select count(*) from section_posts) = 0, 'posts cascade with channel';
end $$;

-- ===== غير المسجّل لا يقرأ شيئاً =====
set role anon;
select t.as_user(null);
select t.expect_error(format('select public.get_section(%L)', 'ABCDEF'), 'permission denied');
select t.expect_error('select * from section_channels', 'permission denied');

reset role;
\echo ALL SECTION TESTS PASSED
