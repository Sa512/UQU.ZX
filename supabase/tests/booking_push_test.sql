-- اختبارات إشعار الدكتور بالحجز: التسجيل، والحد، والخصوصية، وبيانات الإرسال، والحذف.
\set ON_ERROR_STOP 1
\set QUIET 1
\set hp  '00000000-0000-0000-0000-0000000000e1'
\set hs  '00000000-0000-0000-0000-0000000000e2'

reset role;
delete from t.ctx;
set role authenticated;
select t.as_user(:'hp');
-- لا يسجّل عنواناً من لا يملك صفحة ساعات مكتبية
select t.expect_error($q$select public.register_host_push('ExponentPushToken[aaaaaaaaaaaaaaaa]')$q$, 'not_allowed');
with p as (insert into office_hours_pages (title, host_name, slot_minutes) values ('ساعات د. هند', 'د. هند', 15) returning id, code)
insert into t.ctx select 'pid', id::text from p union all select 'code', code from p;
insert into office_hours_windows (page_id, weekday, start_min, end_min) select v::uuid, 2, 600, 720 from t.ctx where k = 'pid';
select t.expect_error($q$select public.register_host_push('https://evil.example')$q$, 'host_push_tokens_token_check');
-- 6 أجهزة: يبقى أحدث 5
do $$ begin
  for i in 1..6 loop
    perform t.must(public.register_host_push(format('ExponentPushToken[device%s-abcdefghij]', i)));
    perform pg_sleep(0.01);
  end loop;
end $$;
select t.expect_error('select * from host_push_tokens', 'permission denied');
select t.expect_error(format('select public.booking_push_targets(%L)', gen_random_uuid()), 'permission denied');

-- طالب يحجز
select t.as_user(:'hs');
select t.must(public.book_office_hour((select v from t.ctx where k = 'code'), t.next_slot(2, 630), 'ريم الشهري', '443001122', 'سؤال عن المشروع'));
reset role;
insert into t.ctx select 'bid', id::text from bookings where student = '00000000-0000-0000-0000-0000000000e2';
set role service_role;
do $$ declare j json := public.booking_push_targets((select v::uuid from t.ctx where k = 'bid'));
begin
  assert j ->> 'student_name' = 'ريم الشهري' and j ->> 'title' = 'ساعات د. هند', 'payload: ' || j;
  assert json_array_length(j -> 'tokens') = 5, 'latest five devices: ' || j;
  assert not (j -> 'tokens')::jsonb ? 'ExponentPushToken[device1-abcdefghij]', 'oldest device dropped';
  assert j::text not like '%443001122%' and j::text not like '%المشروع%', 'no university id or topic in the notification';
end $$;
select public.drop_push_tokens(array['ExponentPushToken[device6-abcdefghij]']);
reset role;
do $$ begin assert (select count(*) from host_push_tokens) = 4, 'dead token dropped'; end $$;
-- الحجز الملغى لا يُرسل عنه
update bookings set status = 'cancelled' where id = (select v::uuid from t.ctx where k = 'bid');
set role service_role;
do $$ begin assert public.booking_push_targets((select v::uuid from t.ctx where k = 'bid')) is null, 'cancelled booking has no targets'; end $$;
-- إلغاء عنوان وحذف البيانات
reset role;
set role authenticated;
select t.as_user(:'hp');
select public.unregister_host_push('ExponentPushToken[device5-abcdefghij]');
do $$ begin assert (public.delete_my_data() ->> 'subscriptions')::int = 3, 'delete_my_data removes host tokens'; end $$;
reset role;
do $$ begin assert (select count(*) from host_push_tokens) = 0, 'all gone'; end $$;
select 'ALL BOOKING PUSH TESTS PASSED';
