-- ============================================================================
-- مذاكر — خدمات السحابة: حجز الساعات المكتبية + التحضير الذاتي بالـ QR
-- يعمل على Supabase (Postgres + Auth بتسجيل دخول مجهول Anonymous Sign-ins).
-- مبدأ الأمان: الجداول محمية بـ RLS، والكتابة الحساسة تتم فقط عبر دوال
-- SECURITY DEFINER تتحقق من كل شرط، وأسماء الطلاب لا تظهر إلا لصاحب الصفحة.
-- ============================================================================

-- في Supabase تُثبَّت الإضافات في مخطط extensions
create extension if not exists pgcrypto with schema extensions;

-- رمز قصير سهل القراءة (بدون 0/O/1/I)
create or replace function public.gen_code(len int default 6)
returns text language plpgsql volatile set search_path = public, extensions as $$
declare
  alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  bytes bytea := gen_random_bytes(len);
  out text := '';
begin
  for i in 0..len - 1 loop
    out := out || substr(alphabet, (get_byte(bytes, i) % length(alphabet)) + 1, 1);
  end loop;
  return out;
end $$;

-- ---------------------------------------------------------------------------
-- الساعات المكتبية
-- ---------------------------------------------------------------------------
create table public.office_hours_pages (
  id uuid primary key default gen_random_uuid(),
  owner uuid not null default auth.uid(),
  code text not null unique default public.gen_code(6),
  title text not null check (char_length(title) between 2 and 120),
  host_name text not null check (char_length(host_name) between 2 and 80),
  slot_minutes int not null default 15 check (slot_minutes between 5 and 120),
  is_open boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.office_hours_windows (
  id uuid primary key default gen_random_uuid(),
  page_id uuid not null references public.office_hours_pages on delete cascade,
  weekday smallint not null check (weekday between 0 and 6), -- 0 = الأحد
  start_min int not null check (start_min between 0 and 1439),
  end_min int not null check (end_min > start_min and end_min <= 1440),
  location text not null default '' check (char_length(location) <= 120)
);

create table public.bookings (
  id uuid primary key default gen_random_uuid(),
  page_id uuid not null references public.office_hours_pages on delete cascade,
  student uuid not null,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  student_name text not null check (char_length(student_name) between 2 and 80),
  uni_id text not null default '' check (uni_id = '' or uni_id ~ '^[0-9]{4,12}$'),
  topic text not null default '' check (char_length(topic) <= 200),
  status text not null default 'booked' check (status in ('booked', 'cancelled')),
  created_at timestamptz not null default now()
);
-- لا يُحجز الموعد نفسه مرتين
create unique index bookings_one_per_slot on public.bookings (page_id, starts_at) where status = 'booked';
create index bookings_student on public.bookings (student);

-- ---------------------------------------------------------------------------
-- التحضير الذاتي
-- ---------------------------------------------------------------------------
create table public.attendance_sessions (
  id uuid primary key default gen_random_uuid(),
  owner uuid not null default auth.uid(),
  code text not null unique default public.gen_code(6),
  label text not null check (char_length(label) between 1 and 120),
  nonce text not null default public.gen_code(8),
  nonce_prev text,
  nonce_at timestamptz not null default now(),
  is_open boolean not null default true,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '3 hours'
);

create table public.checkins (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.attendance_sessions on delete cascade,
  device uuid not null,
  uni_id text not null check (uni_id ~ '^[0-9]{4,12}$'),
  student_name text not null check (char_length(student_name) between 2 and 80),
  at timestamptz not null default now(),
  unique (session_id, device), -- جهاز واحد = تحضير واحد
  unique (session_id, uni_id)  -- رقم جامعي واحد = تحضير واحد
);

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.office_hours_pages enable row level security;
alter table public.office_hours_windows enable row level security;
alter table public.bookings enable row level security;
alter table public.attendance_sessions enable row level security;
alter table public.checkins enable row level security;

create policy pages_owner on public.office_hours_pages for all to authenticated
  using (owner = auth.uid()) with check (owner = auth.uid());

create policy windows_owner on public.office_hours_windows for all to authenticated
  using (exists (select 1 from public.office_hours_pages p where p.id = page_id and p.owner = auth.uid()))
  with check (exists (select 1 from public.office_hours_pages p where p.id = page_id and p.owner = auth.uid()));

-- الطالب يرى حجوزاته، وصاحب الصفحة يرى حجوزات صفحته. الإضافة والإلغاء عبر الدوال فقط.
create policy bookings_read on public.bookings for select to authenticated
  using (student = auth.uid() or exists (select 1 from public.office_hours_pages p where p.id = page_id and p.owner = auth.uid()));

create policy sessions_owner on public.attendance_sessions for all to authenticated
  using (owner = auth.uid()) with check (owner = auth.uid());

create policy checkins_read on public.checkins for select to authenticated
  using (device = auth.uid() or exists (select 1 from public.attendance_sessions s where s.id = session_id and s.owner = auth.uid()));

revoke all on all tables in schema public from anon;
grant select, insert, update, delete on public.office_hours_pages, public.office_hours_windows, public.attendance_sessions to authenticated;
grant select on public.bookings, public.checkins to authenticated;
revoke insert, update, delete on public.bookings, public.checkins from authenticated;

-- ---------------------------------------------------------------------------
-- دوال الحجز
-- ---------------------------------------------------------------------------

-- معلومات الصفحة للطالب: المواعيد المتاحة والمحجوزة (بدون أي أسماء)
create or replace function public.get_office_hours(p_code text)
returns json language sql stable security definer set search_path = public as $$
  select json_build_object(
    'id', p.id, 'title', p.title, 'host_name', p.host_name, 'slot_minutes', p.slot_minutes, 'is_open', p.is_open,
    'windows', coalesce((select json_agg(json_build_object('weekday', w.weekday, 'start_min', w.start_min, 'end_min', w.end_min, 'location', w.location) order by w.weekday, w.start_min)
                         from office_hours_windows w where w.page_id = p.id), '[]'::json),
    'taken', coalesce((select json_agg(b.starts_at order by b.starts_at) from bookings b
                       where b.page_id = p.id and b.status = 'booked' and b.starts_at > now()), '[]'::json)
  )
  from office_hours_pages p where p.code = upper(trim(p_code));
$$;

create or replace function public.book_office_hour(p_code text, p_starts_at timestamptz, p_name text, p_uni_id text, p_topic text default '')
returns uuid language plpgsql volatile security definer set search_path = public as $$
declare
  pg office_hours_pages;
  local_ts timestamp := p_starts_at at time zone 'Asia/Riyadh';
  minute_of_day int := extract(hour from local_ts)::int * 60 + extract(minute from local_ts)::int;
  dow int := extract(dow from local_ts)::int;
  new_id uuid;
begin
  if auth.uid() is null then raise exception 'not_signed_in'; end if;
  select * into pg from office_hours_pages where code = upper(trim(p_code));
  if not found then raise exception 'page_not_found'; end if;
  if not pg.is_open then raise exception 'page_closed'; end if;
  if p_starts_at <= now() then raise exception 'slot_in_past'; end if;
  if p_starts_at > now() + interval '21 days' then raise exception 'slot_too_far'; end if;
  if extract(second from local_ts) <> 0 or not exists (
    select 1 from office_hours_windows w
    where w.page_id = pg.id and w.weekday = dow
      and minute_of_day >= w.start_min and minute_of_day + pg.slot_minutes <= w.end_min
      and (minute_of_day - w.start_min) % pg.slot_minutes = 0
  ) then raise exception 'slot_invalid'; end if;
  if (select count(*) from bookings b where b.page_id = pg.id and b.student = auth.uid() and b.status = 'booked' and b.starts_at > now()) >= 2 then
    raise exception 'too_many_bookings';
  end if;
  begin
    insert into bookings (page_id, student, starts_at, ends_at, student_name, uni_id, topic)
    values (pg.id, auth.uid(), p_starts_at, p_starts_at + make_interval(mins => pg.slot_minutes), trim(p_name), coalesce(trim(p_uni_id), ''), coalesce(trim(p_topic), ''))
    returning id into new_id;
  exception when unique_violation then
    raise exception 'slot_taken';
  end;
  return new_id;
end $$;

create or replace function public.cancel_booking(p_id uuid)
returns void language plpgsql volatile security definer set search_path = public as $$
begin
  update bookings b set status = 'cancelled'
  where b.id = p_id and b.status = 'booked'
    and (b.student = auth.uid() or exists (select 1 from office_hours_pages p where p.id = b.page_id and p.owner = auth.uid()));
  if not found then raise exception 'not_allowed'; end if;
end $$;

-- ---------------------------------------------------------------------------
-- دوال التحضير
-- ---------------------------------------------------------------------------

-- يجدد الرمز الدوري (يستدعيه جهاز الدكتور كل ١٥ ثانية) ويعيده
create or replace function public.rotate_nonce(p_session uuid)
returns text language plpgsql volatile security definer set search_path = public, extensions as $$
declare n text := gen_code(8);
begin
  update attendance_sessions s set nonce_prev = s.nonce, nonce = n, nonce_at = now()
  where s.id = p_session and s.owner = auth.uid() and s.is_open and s.expires_at > now();
  if not found then raise exception 'not_allowed'; end if;
  return n;
end $$;

create or replace function public.check_in(p_code text, p_nonce text, p_uni_id text, p_name text)
returns json language plpgsql volatile security definer set search_path = public as $$
declare
  s attendance_sessions;
  ok boolean;
begin
  if auth.uid() is null then raise exception 'not_signed_in'; end if;
  select * into s from attendance_sessions where code = upper(trim(p_code));
  if not found then raise exception 'session_not_found'; end if;
  if not s.is_open or s.expires_at <= now() then raise exception 'session_closed'; end if;
  -- الرمز الحالي صالح ٣٠ ثانية، والسابق يُقبل حتى ٤٥ ثانية (تأخر الشبكة)
  -- coalesce ضروري: nonce_prev يكون NULL في أول جلسة، والمقارنة معه تعطي NULL لا false
  ok := coalesce(p_nonce = s.nonce and now() - s.nonce_at <= interval '30 seconds', false)
     or coalesce(p_nonce = s.nonce_prev and now() - s.nonce_at <= interval '45 seconds', false);
  if not ok then raise exception 'qr_expired'; end if;
  begin
    insert into checkins (session_id, device, uni_id, student_name) values (s.id, auth.uid(), trim(p_uni_id), trim(p_name));
  exception when unique_violation then
    if exists (select 1 from checkins c where c.session_id = s.id and c.device = auth.uid()) then
      raise exception 'already_checked_in';
    end if;
    raise exception 'uni_id_used';
  end;
  return json_build_object('label', s.label, 'at', now());
end $$;

-- تنظيف: حذف جلسات التحضير بعد ٣٠ يوماً والحجوزات القديمة بعد ٩٠ يوماً (يُجدول عبر pg_cron)
create or replace function public.cleanup_old_data()
returns void language sql volatile security definer set search_path = public as $$
  delete from attendance_sessions where created_at < now() - interval '30 days';
  delete from bookings where starts_at < now() - interval '90 days';
$$;

revoke all on function public.cleanup_old_data() from public, anon, authenticated;
revoke all on function public.get_office_hours(text), public.book_office_hour(text, timestamptz, text, text, text), public.cancel_booking(uuid),
  public.rotate_nonce(uuid), public.check_in(text, text, text, text) from public, anon;
grant execute on function public.get_office_hours(text), public.book_office_hour(text, timestamptz, text, text, text), public.cancel_booking(uuid),
  public.rotate_nonce(uuid), public.check_in(text, text, text, text) to authenticated;
