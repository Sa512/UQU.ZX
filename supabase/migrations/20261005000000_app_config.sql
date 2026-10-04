-- ============================================================================
-- مذاكر 2.2: التحكم الطارئ عن بُعد (دون إصدار نسخة جديدة).
--  - أقل إصدار مسموح (إجبار التحديث عند خلل خطير في نسخة قديمة) + أحدث إصدار (اقتراح التحديث).
--  - وضع الصيانة برسالة، وإعلان عام لكل المستخدمين.
--  - إيقاف ميزة سحابية مؤقتاً (الحجز، التحضير، القنوات، النسخة السحابية).
-- يقرؤه التطبيق قبل تسجيل الدخول أيضاً، ويغيّره المشرف فقط ويُسجَّل كل تغيير.
-- ============================================================================

create table public.app_config (
  id boolean primary key default true check (id),
  min_version text not null default '0.0.0' check (min_version ~ '^[0-9]{1,2}\.[0-9]{1,2}\.[0-9]{1,3}$'),
  latest_version text not null default '0.0.0' check (latest_version ~ '^[0-9]{1,2}\.[0-9]{1,2}\.[0-9]{1,3}$'),
  maintenance boolean not null default false,
  maintenance_message text not null default '' check (char_length(maintenance_message) <= 300),
  banner text not null default '' check (char_length(banner) <= 200),
  banner_level text not null default 'info' check (banner_level in ('info', 'warning')),
  disabled_features text[] not null default '{}' check (disabled_features <@ array['booking', 'checkin', 'channels', 'backup']),
  ios_url text not null default '' check (ios_url = '' or ios_url ~ '^https://apps\.apple\.com/'),
  updated_at timestamptz not null default now()
);
insert into public.app_config default values;
alter table public.app_config enable row level security;
revoke all on public.app_config from anon, authenticated;

create or replace function public.get_app_config()
returns json language sql stable security definer set search_path = public as $$
  select json_build_object('min_version', min_version, 'latest_version', latest_version, 'maintenance', maintenance,
    'maintenance_message', maintenance_message, 'banner', banner, 'banner_level', banner_level,
    'disabled_features', to_json(disabled_features), 'ios_url', ios_url, 'updated_at', updated_at)
  from app_config where id;
$$;
revoke all on function public.get_app_config() from public;
grant execute on function public.get_app_config() to anon, authenticated;

create or replace function public.admin_set_app_config(
  p_min_version text, p_latest_version text, p_maintenance boolean, p_maintenance_message text,
  p_banner text, p_banner_level text, p_disabled text[], p_ios_url text default '')
returns json language plpgsql volatile security definer set search_path = public as $$
declare
  semver constant text := '^[0-9]{1,2}\.[0-9]{1,2}\.[0-9]{1,3}$';
  v_min text := btrim(coalesce(p_min_version, '0.0.0'));
  v_latest text := btrim(coalesce(p_latest_version, '0.0.0'));
  v_disabled text[] := coalesce((select array_agg(distinct f order by f) from unnest(p_disabled) f), '{}');
begin
  if not public.is_admin() then raise exception 'not_allowed'; end if;
  -- أقل إصدار لا يتجاوز أحدث إصدار (وإلا لن يستطيع أحد فتح التطبيق)
  if v_min !~ semver or v_latest !~ semver
     or string_to_array(v_min, '.')::int[] > string_to_array(v_latest, '.')::int[] then
    raise exception 'bad_version';
  end if;
  update app_config set
    min_version = v_min, latest_version = v_latest, maintenance = coalesce(p_maintenance, false),
    maintenance_message = left(btrim(coalesce(p_maintenance_message, '')), 300),
    banner = left(regexp_replace(btrim(coalesce(p_banner, '')), '\s+', ' ', 'g'), 200),
    banner_level = coalesce(p_banner_level, 'info'), disabled_features = v_disabled,
    ios_url = btrim(coalesce(p_ios_url, '')), updated_at = now()
  where id;
  perform log_admin('app_config', format('min %s · latest %s%s%s%s', v_min, v_latest,
    case when coalesce(p_maintenance, false) then ' · maintenance' else '' end,
    case when cardinality(v_disabled) > 0 then ' · off: ' || array_to_string(v_disabled, ',') else '' end,
    case when btrim(coalesce(p_banner, '')) <> '' then ' · banner' else '' end));
  return public.get_app_config();
end $$;
revoke all on function public.admin_set_app_config(text, text, boolean, text, text, text, text[], text) from public, anon;
grant execute on function public.admin_set_app_config(text, text, boolean, text, text, text, text[], text) to authenticated;
