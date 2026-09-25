-- اختبارات إشعارات القناة: الاشتراك، والتحقق من العنوان، والخصوصية، والحذف.
\set ON_ERROR_STOP 1
\set QUIET 1
\set prof '00000000-0000-0000-0000-0000000000a9'
\set st1  '00000000-0000-0000-0000-0000000000b8'
\set st2  '00000000-0000-0000-0000-0000000000b9'

reset role;
delete from t.ctx;
set role authenticated;

select t.as_user(:'prof');
with c as (insert into section_channels (course_name, instructor) values ('إشعارات', 'د. سارة') returning id, code)
insert into t.ctx select 'cid', id::text from c union all select 'code', code from c;

-- الطالب يشترك بعنوان صحيح (مرتين بلا تكرار)
select t.as_user(:'st1');
select t.must(public.subscribe_channel(lower((select v from t.ctx where k = 'code')), 'ExponentPushToken[abcdefghij1234567890]'));
select t.must(public.subscribe_channel((select v from t.ctx where k = 'code'), 'ExponentPushToken[abcdefghij1234567890]'));
-- عنوان غير صالح أو رمز خاطئ
select t.expect_error(format('select public.subscribe_channel(%L, %L)', (select v from t.ctx where k = 'code'), 'https://evil.example/hook'), 'channel_subscribers_token_check');
select t.expect_error($q$select public.subscribe_channel('ZZZZZZ', 'ExponentPushToken[abcdefghij1234567890]')$q$, 'section_not_found');
-- لا أحد يقرأ العناوين مباشرة، ولا يستدعي دوال الإرسال
select t.expect_error('select * from channel_subscribers', 'permission denied');
select t.expect_error(format('select public.post_push_targets(%L)', gen_random_uuid()), 'permission denied');
select t.expect_error($q$select public.drop_push_tokens(array['x'])$q$, 'permission denied');

select t.as_user(:'st2');
select t.must(public.subscribe_channel((select v from t.ctx where k = 'code'), 'ExpoPushToken[zyxwvutsrq0987654321]'));
-- طالب لا يلغي اشتراك غيره
select public.unsubscribe_channel((select v from t.ctx where k = 'code'), 'ExponentPushToken[abcdefghij1234567890]');

-- دالة الإرسال (service_role) ترى العنوانين ونص الإعلان
select t.as_user(:'prof');
with p as (insert into section_posts (channel_id, body) select v::uuid, 'الاختبار غداً' from t.ctx where k = 'cid' returning id)
insert into t.ctx select 'post', id::text from p;
reset role;
grant usage on schema t to service_role;
grant select on t.ctx to service_role;
set role service_role;
do $$
declare j json;
begin
  j := public.post_push_targets((select v::uuid from t.ctx where k = 'post'));
  assert j ->> 'course_name' = 'إشعارات' and j ->> 'body' = 'الاختبار غداً', 'payload';
  assert json_array_length(j -> 'tokens') = 2, 'both subscribers (other student could not unsubscribe st1)';
end $$;
select public.drop_push_tokens(array['ExpoPushToken[zyxwvutsrq0987654321]']);
reset role;
do $$ begin assert (select count(*) from channel_subscribers) = 1, 'dead token dropped'; end $$;

-- الطالب يلغي اشتراكه، ثم حذف البيانات يشمل الاشتراكات
set role authenticated;
select t.as_user(:'st1');
select public.unsubscribe_channel((select v from t.ctx where k = 'code'), 'ExponentPushToken[abcdefghij1234567890]');
reset role;
do $$ begin assert (select count(*) from channel_subscribers) = 0, 'own unsubscribe works'; end $$;
set role authenticated;
select t.must(public.subscribe_channel((select v from t.ctx where k = 'code'), 'ExponentPushToken[abcdefghij1234567890]'));
do $$ begin assert (public.delete_my_data() ->> 'subscriptions')::int = 1, 'delete_my_data removes subscriptions'; end $$;

-- حذف القناة يحذف اشتراكاتها
select t.as_user(:'st2');
select t.must(public.subscribe_channel((select v from t.ctx where k = 'code'), 'ExpoPushToken[zyxwvutsrq0987654321]'));
select t.as_user(:'prof');
delete from section_channels;
reset role;
do $$ begin assert (select count(*) from channel_subscribers) = 0, 'subscriptions cascade with channel'; end $$;

set role anon;
select t.as_user(null);
select t.expect_error($q$select public.subscribe_channel('ABCDEF', 'ExponentPushToken[abcdefghij1234567890]')$q$, 'permission denied');
reset role;
\echo ALL PUSH TESTS PASSED
