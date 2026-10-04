-- اختبارات 2.2: التحكم الطارئ — يقرؤه الجميع (حتى قبل الدخول)، ويغيّره المشرف فقط، بقيود تمنع إغلاق التطبيق خطأً.
\set ON_ERROR_STOP 1
\set QUIET 1

reset role;
delete from t.ctx;
insert into t.ctx select 'adm', id::text from auth.users where email = 'asd1911147@gmail.com';

-- قبل الدخول: يقرأ الإعدادات ولا يرى الجدول
set role anon;
select t.as_user(null);
do $$ declare c json := public.get_app_config();
begin
  assert c ->> 'min_version' = '0.0.0' and (c ->> 'maintenance')::boolean = false and json_array_length(c -> 'disabled_features') = 0, 'defaults: ' || c;
end $$;
select t.expect_error('select * from app_config', 'permission denied');
select t.expect_error($q$select public.admin_set_app_config('1.0.0', '2.0.0', false, '', '', 'info', '{}')$q$, 'permission denied');

-- مستخدم عادي لا يغيّر
reset role;
set role authenticated;
select t.as_user('00000000-0000-0000-0000-0000000000f2');
select t.expect_error($q$select public.admin_set_app_config('1.0.0', '2.0.0', true, 'x', '', 'info', '{}')$q$, 'not_allowed');
select t.expect_error($q$update app_config set maintenance = true$q$, 'permission denied');

-- المشرف
select t.as_email((select v from t.ctx where k = 'adm'), 'asd1911147@gmail.com');
select t.expect_error($q$select public.admin_set_app_config('2.3.0', '2.2.0', false, '', '', 'info', '{}')$q$, 'bad_version');
select t.expect_error($q$select public.admin_set_app_config('2.10.0', '2.9.0', false, '', '', 'info', '{}')$q$, 'bad_version');
select t.expect_error($q$select public.admin_set_app_config('2.x', '2.2.0', false, '', '', 'info', '{}')$q$, 'bad_version');
select t.expect_error($q$select public.admin_set_app_config('2.0.0', '2.2.0', false, '', '', 'info', array['payments'])$q$, 'app_config_disabled_features_check');
select t.expect_error($q$select public.admin_set_app_config('2.0.0', '2.2.0', false, '', '', 'loud', '{}')$q$, 'app_config_banner_level_check');
select t.expect_error($q$select public.admin_set_app_config('2.0.0', '2.2.0', false, '', '', 'info', '{}', 'https://evil.example/app')$q$, 'app_config_ios_url_check');
do $$ declare c json := public.admin_set_app_config('2.0.0', '2.10.0', true, '  نحدّث الخادم الساعة 2 ص  ', E'  تحديث\nمهم  ', 'warning', array['booking', 'backup', 'booking'], 'https://apps.apple.com/sa/app/id123');
begin
  assert c ->> 'min_version' = '2.0.0' and c ->> 'latest_version' = '2.10.0', 'versions (2.0.0 <= 2.10.0 numerically): ' || c;
  assert (c ->> 'maintenance')::boolean and c ->> 'maintenance_message' = 'نحدّث الخادم الساعة 2 ص', 'maintenance trimmed';
  assert c ->> 'banner' = 'تحديث مهم' and c ->> 'banner_level' = 'warning', 'banner cleaned';
  assert (c -> 'disabled_features')::text = '["backup","booking"]', 'features deduped and sorted: ' || (c -> 'disabled_features');
end $$;
reset role;
do $$ begin
  assert (select action || ' ' || target from admin_log order by id desc limit 1) = 'app_config min 2.0.0 · latest 2.10.0 · maintenance · off: backup,booking · banner', 'logged: ' || (select target from admin_log order by id desc limit 1);
  assert (select count(*) from app_config) = 1, 'single row';
end $$;
select t.expect_error($q$insert into app_config (id) values (false)$q$, 'app_config_id_check');

-- يقرؤه الطالب كما ضُبط، ثم يُعاد للوضع العادي
set role authenticated;
select t.as_user('00000000-0000-0000-0000-0000000000f2');
do $$ begin assert (public.get_app_config() ->> 'maintenance')::boolean, 'students see maintenance'; end $$;
select t.as_email((select v from t.ctx where k = 'adm'), 'asd1911147@gmail.com');
select public.admin_set_app_config('0.0.0', '2.2.0', false, '', '', 'info', '{}');
do $$ begin assert json_array_length(public.get_app_config() -> 'disabled_features') = 0, 'reset'; end $$;
reset role;
select 'ALL APP CONFIG TESTS PASSED';
