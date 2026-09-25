-- ============================================================================
-- مذاكر — «قناة الشعبة»: الدكتور ينشر جدول الشعبة ومواعيد اختباراتها وإعلاناته،
-- والطلاب ينضمون برمز من 6 خانات فتُضاف المادة عندهم وتصلهم التحديثات.
-- الأمان: الكتابة لصاحب القناة فقط عبر RLS، والقراءة للطلاب عبر دالة واحدة
-- بالرمز لا تكشف هوية صاحب القناة. لا تُخزَّن أي بيانات عن الطلاب هنا.
-- ============================================================================

create table public.section_channels (
  id uuid primary key default gen_random_uuid(),
  owner uuid not null default auth.uid(),
  code text not null unique default public.gen_code(6),
  course_name text not null check (char_length(course_name) between 2 and 120),
  course_code text not null default '' check (char_length(course_code) <= 20),
  section_code text not null default '' check (char_length(section_code) <= 20),
  instructor text not null check (char_length(instructor) between 2 and 80),
  color text not null default '#4F46E5' check (color ~ '^#[0-9A-Fa-f]{6}$'),
  -- [{weekday, start_min, end_min, type, location}] و [{title, date, type}]؛ يتحقق التطبيق من الشكل عند القراءة
  slots jsonb not null default '[]' check (jsonb_typeof(slots) = 'array' and jsonb_array_length(slots) <= 20 and pg_column_size(slots) <= 8192),
  exams jsonb not null default '[]' check (jsonb_typeof(exams) = 'array' and jsonb_array_length(exams) <= 30 and pg_column_size(exams) <= 8192),
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table public.section_posts (
  id uuid primary key default gen_random_uuid(),
  channel_id uuid not null references public.section_channels on delete cascade,
  body text not null check (char_length(btrim(body)) between 1 and 500),
  created_at timestamptz not null default now()
);
create index section_posts_channel on public.section_posts (channel_id, created_at desc);
create index section_channels_owner on public.section_channels (owner);

alter table public.section_channels enable row level security;
alter table public.section_posts enable row level security;

create policy channels_owner on public.section_channels for all to authenticated
  using (owner = auth.uid()) with check (owner = auth.uid());

create policy posts_owner on public.section_posts for all to authenticated
  using (exists (select 1 from public.section_channels c where c.id = channel_id and c.owner = auth.uid()))
  with check (exists (select 1 from public.section_channels c where c.id = channel_id and c.owner = auth.uid()));

-- Supabase يمنح الجداول الجديدة كل الصلاحيات افتراضياً؛ نسحبها كلها ثم نمنح المطلوب فقط
revoke all on public.section_channels, public.section_posts from anon, authenticated;
-- صلاحيات على الأعمدة: لا يختار أحد الرمز أو المالك أو التواريخ بنفسه
-- (ملاحظة: سحب صلاحية عمود لا يلغي صلاحية الجدول كاملاً، لذا نمنح الأعمدة المسموحة فقط)
grant select, delete on public.section_channels to authenticated;
grant insert (course_name, course_code, section_code, instructor, color, slots, exams) on public.section_channels to authenticated;
grant update (course_name, course_code, section_code, instructor, color, slots, exams) on public.section_channels to authenticated;
grant select, delete on public.section_posts to authenticated;
grant insert (channel_id, body) on public.section_posts to authenticated;

-- حد الإعلانات: 20 إعلاناً في اليوم لكل قناة (حماية من الإغراق)
create or replace function public.section_posts_limit()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if (select count(*) from section_posts where channel_id = new.channel_id and created_at > now() - interval '1 day') >= 20 then
    raise exception 'too_many_posts';
  end if;
  update section_channels set updated_at = now() where id = new.channel_id;
  return new;
end $$;
create trigger section_posts_limit before insert on public.section_posts
  for each row execute function public.section_posts_limit();

-- أي تعديل على القناة يحدّث وقت آخر تحديث (ليعرف الطلاب أن هناك جديداً)
create or replace function public.section_channels_touch()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;
create trigger section_channels_touch before update on public.section_channels
  for each row execute function public.section_channels_touch();

-- قراءة القناة للطالب بالرمز: بلا هوية المالك، وآخر 20 إعلاناً فقط
create or replace function public.get_section(p_code text)
returns json language sql stable security definer set search_path = public as $$
  select json_build_object(
    'id', c.id, 'code', c.code, 'course_name', c.course_name, 'course_code', c.course_code, 'section_code', c.section_code,
    'instructor', c.instructor, 'color', c.color, 'slots', c.slots, 'exams', c.exams, 'updated_at', c.updated_at,
    'posts', coalesce((select json_agg(json_build_object('id', p.id, 'body', p.body, 'created_at', p.created_at) order by p.created_at desc)
                       from (select * from section_posts where channel_id = c.id order by created_at desc limit 20) p), '[]'::json)
  )
  from section_channels c where c.code = upper(btrim(p_code));
$$;

revoke all on function public.get_section(text) from public, anon;
grant execute on function public.get_section(text) to authenticated;
revoke all on function public.section_posts_limit(), public.section_channels_touch() from public, anon, authenticated;

-- التنظيف الدوري: الإعلانات الأقدم من 6 أشهر
create or replace function public.cleanup_old_data()
returns void language sql volatile security definer set search_path = public as $$
  delete from attendance_sessions where created_at < now() - interval '30 days';
  delete from bookings where starts_at < now() - interval '90 days';
  delete from section_posts where created_at < now() - interval '180 days';
$$;
revoke all on function public.cleanup_old_data() from public, anon, authenticated;
