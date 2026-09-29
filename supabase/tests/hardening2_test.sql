-- اختبارات تقوية 1.8: email_kind للمسجلين فقط، وحد تصدير المشرف، ومنع الدكتور المرفوض من النشر.
\set ON_ERROR_STOP 1
\set QUIET 1
\set drs  '00000000-0000-0000-0000-0000000000d2'
\set sts  '00000000-0000-0000-0000-0000000000d3'

set role anon;
select t.as_user(null);
select t.expect_error($q$select public.email_kind('a@uqu.edu.sa')$q$, 'permission denied');
set role authenticated;

-- الدكتور المرفوض (من مجموعة الأمان) لا ينشئ صفحة ولا قناة
select t.as_email(:'drs', 'f.zahrani@uqu.edu.sa');
select t.expect_error($q$insert into office_hours_pages (title, host_name, slot_minutes) values ('جديدة', 'د. فهد', 15)$q$, 'row-level security');
select t.expect_error($q$insert into section_channels (course_name, instructor) values ('مقرر', 'د. فهد')$q$, 'row-level security');
-- الطالب ينشئ كالمعتاد (غير متأثر)
select t.as_email(:'sts', 's442000111@st.uqu.edu.sa');
insert into section_channels (course_name, instructor) values ('مجموعة دراسة', 'نورة');

-- حد التصدير: 10 في الساعة لكل مشرف (المجموعات السابقة استخدمت بعضها)
select t.as_email(:'adm', 'asd1911147@gmail.com');
do $$ declare n int := 0;
begin
  loop
    begin
      perform public.admin_export();
      n := n + 1;
    exception when others then
      assert sqlerrm like '%rate_limited%', 'unexpected: ' || sqlerrm;
      exit;
    end;
    assert n <= 10, 'export not throttled';
  end loop;
  assert n between 1 and 10, 'some exports allowed before limit: ' || n;
end $$;
do $$ begin assert json_array_length(public.admin_users()) > 0, 'listing still works'; end $$;
select 'ALL HARDENING2 TESTS PASSED';
