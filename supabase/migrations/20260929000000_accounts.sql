-- ============================================================================
-- مذاكر 1.6: حسابات بالإيميل الجامعي، ودليل الساعات المكتبية، ولوحة المشرف.
-- - كل مستخدم له ملف (الاسم، الإيميل الجامعي، الجامعة، الدور). لا نجمع تاريخ الميلاد ولا أي بيانة زائدة.
-- - الدور يُستنتج على الخادم من الإيميل: إيميل الطلاب لا يسجّل كدكتور. الإيميل غير المعروف يسجّل كدكتور
--   «بانتظار الموافقة» ولا يظهر للطلاب حتى يوافق المشرف.
-- - الطالب يرى الدكاترة المعتمدين في جامعته الذين فتحوا الحجز، ويحجز دون رمز.
-- - المشرف فقط يرى قائمة المستخدمين ويصدّرها (لا وصول مباشر للجداول لأي مستخدم).
-- ============================================================================

-- استثناءات بالإيميل: المشرف (قد يكون إيميلاً شخصياً)، وحساب مراجعة المتاجر، وأي حالة خاصة يضيفها المشرف
create table public.email_overrides (
  email text primary key check (email = lower(email) and email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  role text check (role in ('student', 'professor')),
  is_admin boolean not null default false,
  note text not null default '' check (char_length(note) <= 200),
  created_at timestamptz not null default now()
);

-- قواعد نطاقات الجامعات: النطاق ← الجامعة ونوع الإيميل (طالب أو منسوب)
create table public.domain_rules (
  domain text primary key check (domain = lower(domain) and domain ~ '^[a-z0-9.-]+\.[a-z]{2,}$'),
  university text not null check (char_length(university) between 2 and 120),
  kind text not null check (kind in ('student', 'staff'))
);

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null unique,
  full_name text not null check (char_length(full_name) between 2 and 80),
  university text not null default '' check (char_length(university) <= 120),
  role text not null check (role in ('student', 'professor')),
  -- active: مفعّل · pending: دكتور بانتظار موافقة المشرف · rejected: رُفض طلبه كدكتور
  status text not null default 'active' check (status in ('active', 'pending', 'rejected')),
  is_admin boolean not null default false,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);
create index profiles_university on public.profiles (university, role, status);

alter table public.email_overrides enable row level security;
alter table public.domain_rules enable row level security;
alter table public.profiles enable row level security;
revoke all on public.email_overrides, public.domain_rules, public.profiles from anon, authenticated;

-- الجامعات السعودية الرئيسية: النطاق الأساسي لمنسوبيها. إيميلات الطلاب تُعرف من نطاقاتها الفرعية
-- (st. / stu. / student. …) أو من الرقم الجامعي في أول الإيميل؛ ويعدّل المشرف أي قاعدة من لوحته.
insert into public.domain_rules (domain, university, kind) values
  ('uqu.edu.sa', 'جامعة أم القرى', 'staff'),
  ('ksu.edu.sa', 'جامعة الملك سعود', 'staff'),
  ('kau.edu.sa', 'جامعة الملك عبدالعزيز', 'staff'),
  ('imamu.edu.sa', 'جامعة الإمام محمد بن سعود الإسلامية', 'staff'),
  ('kfupm.edu.sa', 'جامعة الملك فهد للبترول والمعادن', 'staff'),
  ('pnu.edu.sa', 'جامعة الأميرة نورة بنت عبدالرحمن', 'staff'),
  ('kku.edu.sa', 'جامعة الملك خالد', 'staff'),
  ('qu.edu.sa', 'جامعة القصيم', 'staff'),
  ('taibahu.edu.sa', 'جامعة طيبة', 'staff'),
  ('tu.edu.sa', 'جامعة الطائف', 'staff'),
  ('kfu.edu.sa', 'جامعة الملك فيصل', 'staff'),
  ('iau.edu.sa', 'جامعة الإمام عبدالرحمن بن فيصل', 'staff'),
  ('uj.edu.sa', 'جامعة جدة', 'staff'),
  ('jazanu.edu.sa', 'جامعة جازان', 'staff'),
  ('uoh.edu.sa', 'جامعة حائل', 'staff'),
  ('ju.edu.sa', 'جامعة الجوف', 'staff'),
  ('ut.edu.sa', 'جامعة تبوك', 'staff'),
  ('bu.edu.sa', 'جامعة الباحة', 'staff'),
  ('nu.edu.sa', 'جامعة نجران', 'staff'),
  ('nbu.edu.sa', 'جامعة الحدود الشمالية', 'staff'),
  ('psau.edu.sa', 'جامعة الأمير سطام بن عبدالعزيز', 'staff'),
  ('mu.edu.sa', 'جامعة المجمعة', 'staff'),
  ('su.edu.sa', 'جامعة شقراء', 'staff'),
  ('ub.edu.sa', 'جامعة بيشة', 'staff'),
  ('uhb.edu.sa', 'جامعة حفر الباطن', 'staff'),
  ('iu.edu.sa', 'الجامعة الإسلامية بالمدينة المنورة', 'staff'),
  ('seu.edu.sa', 'الجامعة السعودية الإلكترونية', 'staff'),
  ('ksau-hs.edu.sa', 'جامعة الملك سعود بن عبدالعزيز للعلوم الصحية', 'staff'),
  ('kaust.edu.sa', 'جامعة الملك عبدالله للعلوم والتقنية', 'staff'),
  ('alfaisal.edu', 'جامعة الفيصل', 'staff'),
  ('psu.edu.sa', 'جامعة الأمير سلطان', 'staff'),
  ('pmu.edu.sa', 'جامعة الأمير محمد بن فهد', 'staff'),
  ('yu.edu.sa', 'جامعة اليمامة', 'staff'),
  ('dah.edu.sa', 'جامعة دار الحكمة', 'staff'),
  ('effatuniversity.edu.sa', 'جامعة عفت', 'staff'),
  ('ubt.edu.sa', 'جامعة الأعمال والتكنولوجيا', 'staff');

-- المشرف الأول: إيميل الدعم المعلن للتطبيق (غيّره أو أضف غيره من لوحة المشرف)
insert into public.email_overrides (email, is_admin, note) values ('asd1911147@gmail.com', true, 'مالك التطبيق');

-- إيميل المستخدم من رمز الدخول الموقّع (Supabase يضعه في JWT بعد تأكيد الإيميل)
create or replace function public.my_email() returns text language sql stable as $$
  select nullif(lower(btrim(current_setting('request.jwt.claims', true)::json ->> 'email')), '')
$$;

-- نوع الإيميل: student · staff · unknown (جامعي لا نعرف نوعه) · not_university
create or replace function public.email_kind(p_email text)
returns json language plpgsql stable security definer set search_path = public as $$
declare
  e text := lower(btrim(coalesce(p_email, '')));
  local text := split_part(e, '@', 1);
  dom text := split_part(e, '@', 2);
  r domain_rules;
  sub text;
begin
  if local = '' or dom = '' or position('@' in dom) > 0 then return json_build_object('kind', 'not_university'); end if;
  -- أطول قاعدة مطابقة (النطاق نفسه أو نطاق فرعي منه)
  select * into r from domain_rules d where dom = d.domain or dom like '%.' || d.domain order by char_length(d.domain) desc limit 1;
  if found and dom = r.domain and r.kind = 'student' then return json_build_object('kind', 'student', 'university', r.university); end if;
  if found and dom <> r.domain then
    sub := left(dom, char_length(dom) - char_length(r.domain) - 1);
    if split_part(sub, '.', 1) in ('st', 'stu', 'std', 'student', 'students') or r.kind = 'student' then
      return json_build_object('kind', 'student', 'university', r.university);
    end if;
  end if;
  -- الرقم الجامعي في أول الإيميل (مثل s441012345@ أو 441012345@) = طالب
  if local ~ '^[a-z]?[0-9]{7,}$' and (found or dom like '%.edu.sa') then
    return json_build_object('kind', 'student', 'university', r.university);
  end if;
  if found then return json_build_object('kind', r.kind, 'university', r.university); end if;
  if dom like '%.edu.sa' then
    if split_part(dom, '.', 1) in ('st', 'stu', 'std', 'student', 'students') then return json_build_object('kind', 'student'); end if;
    return json_build_object('kind', 'unknown');
  end if;
  return json_build_object('kind', 'not_university');
end $$;

create or replace function public.profile_json(p profiles) returns json language sql stable as $$
  select json_build_object('id', p.id, 'email', p.email, 'full_name', p.full_name, 'university', p.university, 'role', p.role, 'status', p.status, 'is_admin', p.is_admin)
$$;

-- يُنشئ ملف المستخدم أو يحدّثه. الدور يُحسم هنا لا في التطبيق.
create or replace function public.complete_profile(p_name text, p_role text, p_university text default '')
returns json language plpgsql volatile security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  em text := public.my_email();
  k json;
  kind text;
  ov email_overrides;
  st text := 'active';
  uni text;
  p profiles;
begin
  if me is null or em is null then raise exception 'not_signed_in'; end if;
  if p_role not in ('student', 'professor') then raise exception 'bad_role'; end if;
  if char_length(btrim(coalesce(p_name, ''))) not between 2 and 80 then raise exception 'bad_name'; end if;
  k := public.email_kind(em);
  kind := k ->> 'kind';
  select * into ov from email_overrides where email = em;
  if kind = 'not_university' and ov.email is null then raise exception 'not_university_email'; end if;
  if ov.role is not null and ov.role <> p_role and not ov.is_admin then raise exception 'role_locked'; end if;
  if p_role = 'professor' and ov.email is null then
    if kind = 'student' then raise exception 'student_email'; end if;
    if kind <> 'staff' then st := 'pending'; end if;
  end if;
  -- الجامعة من نطاق الإيميل إن كان معروفاً، وإلا ما كتبه المستخدم
  uni := left(coalesce(k ->> 'university', nullif(btrim(p_university), ''), ''), 120);
  select * into p from profiles where id = me;
  if found then
    -- لا يعود الدكتور المرفوض «بانتظار الموافقة» بإعادة التسجيل، ولا يتغير الدور المعتمد إلا بقرار المشرف
    if p.status = 'rejected' and p_role = 'professor' then st := 'rejected'; end if;
    if p.role = 'professor' and p.status = 'active' and p_role = 'professor' then st := 'active'; end if;
    update profiles set full_name = btrim(p_name), university = uni, role = p_role, status = st, last_seen_at = now()
      where id = me returning * into p;
  else
    insert into profiles (id, email, full_name, university, role, status, is_admin)
      values (me, em, btrim(p_name), uni, p_role, st, coalesce(ov.is_admin, false)) returning * into p;
  end if;
  return public.profile_json(p);
end $$;

create or replace function public.my_profile() returns json language plpgsql volatile security definer set search_path = public as $$
declare p profiles;
begin
  if auth.uid() is null then raise exception 'not_signed_in'; end if;
  update profiles set last_seen_at = now() where id = auth.uid() returning * into p;
  if not found then return null; end if;
  return public.profile_json(p);
end $$;

-- دليل الساعات المكتبية: الدكاترة المعتمدون في جامعة الطالب الذين فتحوا الحجز
create or replace function public.list_office_hosts(p_query text default '')
returns json language plpgsql volatile security definer set search_path = public as $$
declare uni text; q text := btrim(coalesce(p_query, ''));
begin
  perform throttle('lookup', 30, interval '1 minute');
  select university into uni from profiles where id = auth.uid();
  if uni is null then raise exception 'no_profile'; end if;
  return coalesce((
    select json_agg(x order by x.host_name) from (
      select pg.code, pg.title, pr.full_name as host_name, pg.slot_minutes
      from office_hours_pages pg join profiles pr on pr.id = pg.owner
      where pg.is_open and pr.role = 'professor' and pr.status = 'active' and pr.university = uni and uni <> ''
        and (q = '' or pr.full_name ilike '%' || replace(replace(q, '%', ''), '_', '') || '%' or pg.title ilike '%' || replace(replace(q, '%', ''), '_', '') || '%')
      limit 100
    ) x), '[]'::json);
end $$;

-- ---------------------------------------------------------------------------
-- لوحة المشرف
-- ---------------------------------------------------------------------------
create or replace function public.is_admin() returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles where id = auth.uid() and is_admin)
$$;

create or replace function public.admin_overview() returns json language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'not_allowed'; end if;
  return json_build_object(
    'students', (select count(*) from profiles where role = 'student'),
    'professors', (select count(*) from profiles where role = 'professor' and status = 'active'),
    'pending', (select count(*) from profiles where role = 'professor' and status = 'pending'),
    'new_week', (select count(*) from profiles where created_at > now() - interval '7 days'),
    'active_week', (select count(*) from profiles where last_seen_at > now() - interval '7 days'),
    'open_pages', (select count(*) from office_hours_pages where is_open),
    'bookings_week', (select count(*) from bookings where created_at > now() - interval '7 days'),
    'universities', coalesce((select json_agg(u) from (select university, count(*) as users from profiles group by university order by count(*) desc limit 10) u), '[]'::json)
  );
end $$;

create or replace function public.admin_users(p_query text default '', p_role text default null, p_status text default null, p_limit int default 50, p_offset int default 0)
returns json language plpgsql stable security definer set search_path = public as $$
declare q text := replace(replace(btrim(coalesce(p_query, '')), '%', ''), '_', '');
begin
  if not public.is_admin() then raise exception 'not_allowed'; end if;
  return coalesce((
    select json_agg(x) from (
      select id, email, full_name, university, role, status, is_admin, created_at, last_seen_at from profiles
      where (q = '' or full_name ilike '%' || q || '%' or email ilike '%' || q || '%' or university ilike '%' || q || '%')
        and (p_role is null or role = p_role) and (p_status is null or status = p_status)
      order by (status = 'pending') desc, created_at desc
      limit least(greatest(p_limit, 1), 500) offset greatest(p_offset, 0)
    ) x), '[]'::json);
end $$;

create or replace function public.admin_set_user(p_id uuid, p_role text, p_status text)
returns json language plpgsql volatile security definer set search_path = public as $$
declare p profiles;
begin
  if not public.is_admin() then raise exception 'not_allowed'; end if;
  if p_role not in ('student', 'professor') or p_status not in ('active', 'pending', 'rejected') then raise exception 'bad_role'; end if;
  update profiles set role = p_role, status = p_status where id = p_id returning * into p;
  if not found then raise exception 'not_found'; end if;
  -- دكتور مرفوض أو محوّل لطالب: تُغلق صفحة حجزه فلا تظهر في الدليل
  if not (p_role = 'professor' and p_status = 'active') then update office_hours_pages set is_open = false where owner = p_id; end if;
  return public.profile_json(p);
end $$;

-- كل الملفات للتصدير إلى Excel (للمشرف فقط)
create or replace function public.admin_export() returns json language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'not_allowed'; end if;
  return coalesce((select json_agg(x order by x.created_at) from (
    select p.email, p.full_name, p.university, p.role, p.status, p.created_at, p.last_seen_at,
      (select count(*) from bookings b where b.student = p.id) as bookings,
      (select count(*) from office_hours_pages o where o.owner = p.id and o.is_open) as open_pages
    from profiles p limit 50000) x), '[]'::json);
end $$;

create or replace function public.admin_rules() returns json language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'not_allowed'; end if;
  return json_build_object(
    'domains', coalesce((select json_agg(d order by d.university, d.domain) from domain_rules d), '[]'::json),
    'overrides', coalesce((select json_agg(o order by o.created_at) from email_overrides o), '[]'::json));
end $$;

create or replace function public.admin_set_rule(p_domain text, p_university text, p_kind text)
returns void language plpgsql volatile security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'not_allowed'; end if;
  if p_kind is null then delete from domain_rules where domain = lower(btrim(p_domain)); return; end if;
  insert into domain_rules (domain, university, kind) values (lower(btrim(p_domain)), btrim(p_university), p_kind)
    on conflict (domain) do update set university = excluded.university, kind = excluded.kind;
end $$;

-- استثناء لإيميل محدد (مثل حساب مراجعة Apple أو مشرف إضافي). p_role و p_admin معاً null = حذف الاستثناء
create or replace function public.admin_set_override(p_email text, p_role text, p_admin boolean, p_note text default '')
returns void language plpgsql volatile security definer set search_path = public as $$
declare e text := lower(btrim(p_email));
begin
  if not public.is_admin() then raise exception 'not_allowed'; end if;
  if p_role is null and not coalesce(p_admin, false) then
    if e = public.my_email() then raise exception 'not_allowed'; end if; -- لا يزيل المشرف صلاحيته بنفسه بالخطأ
    delete from email_overrides where email = e;
    update profiles set is_admin = false where email = e;
    return;
  end if;
  insert into email_overrides (email, role, is_admin, note) values (e, p_role, coalesce(p_admin, false), left(coalesce(p_note, ''), 200))
    on conflict (email) do update set role = excluded.role, is_admin = excluded.is_admin, note = excluded.note;
  update profiles set is_admin = coalesce(p_admin, false) where email = e;
end $$;

-- حذف الحساب بالكامل (شرط App Store): البيانات على الخادم ثم الملف ثم الحساب نفسه
create or replace function public.delete_my_account() returns void language plpgsql volatile security definer set search_path = public as $$
declare me uuid := auth.uid();
begin
  if me is null then raise exception 'not_signed_in'; end if;
  perform public.delete_my_data();
  delete from profiles where id = me;
  delete from auth.users where id = me;
end $$;

revoke all on function public.email_kind(text), public.profile_json(profiles), public.complete_profile(text, text, text), public.my_profile(),
  public.list_office_hosts(text), public.is_admin(), public.admin_overview(), public.admin_users(text, text, text, int, int),
  public.admin_set_user(uuid, text, text), public.admin_export(), public.admin_rules(), public.admin_set_rule(text, text, text),
  public.admin_set_override(text, text, boolean, text), public.delete_my_account(), public.my_email() from public, anon;
grant execute on function public.complete_profile(text, text, text), public.my_profile(), public.list_office_hosts(text), public.is_admin(),
  public.admin_overview(), public.admin_users(text, text, text, int, int), public.admin_set_user(uuid, text, text), public.admin_export(),
  public.admin_rules(), public.admin_set_rule(text, text, text), public.admin_set_override(text, text, boolean, text), public.delete_my_account()
  to authenticated;
-- email_kind تُستدعى من التطبيق قبل التسجيل لتوضيح الخطأ مبكراً (لا تكشف إلا نوع النطاق)
grant execute on function public.email_kind(text) to anon, authenticated;
