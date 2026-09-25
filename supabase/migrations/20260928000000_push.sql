-- ============================================================================
-- مذاكر 1.4 — إشعارات فورية لإعلانات قناة الشعبة.
-- الطالب المنضم يسجّل «عنوان إشعارات» جهازه (Expo push token) للقناة. لا يُحفظ عنه أي شيء آخر،
-- ولا يرى الدكتور من اشترك. الإرسال يتم من دالة على الخادم (Edge Function) عند كل إعلان جديد.
-- ============================================================================

create table public.channel_subscribers (
  id uuid primary key default gen_random_uuid(),
  channel_id uuid not null references public.section_channels on delete cascade,
  subscriber uuid not null default auth.uid(),
  token text not null check (token ~ '^Expo(nent)?PushToken\[[A-Za-z0-9_-]{10,80}\]$'),
  created_at timestamptz not null default now(),
  unique (channel_id, token)
);
create index channel_subscribers_channel on public.channel_subscribers (channel_id);
alter table public.channel_subscribers enable row level security;
-- لا وصول مباشر لأي مستخدم؛ الاشتراك والإلغاء عبر الدوال فقط
revoke all on public.channel_subscribers from anon, authenticated;

-- حد: 50 قناة لكل مستخدم (يمنع إغراق الجداول)
create or replace function public.subscribe_channel(p_code text, p_token text)
returns json language plpgsql volatile security definer set search_path = public as $$
declare cid uuid;
begin
  perform throttle('subscribe', 20, interval '1 minute');
  begin
    select id into cid from section_channels where code = upper(btrim(p_code));
    if cid is null then raise exception 'section_not_found'; end if;
    if (select count(*) from channel_subscribers where subscriber = auth.uid()) >= 50 then raise exception 'too_many_subscriptions'; end if;
    insert into channel_subscribers (channel_id, token) values (cid, btrim(p_token)) on conflict (channel_id, token) do nothing;
    return json_build_object('ok', true);
  exception when others then
    return json_build_object('error', sqlerrm);
  end;
end $$;

create or replace function public.unsubscribe_channel(p_code text, p_token text)
returns void language plpgsql volatile security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'not_signed_in'; end if;
  delete from channel_subscribers s using section_channels c
  where s.channel_id = c.id and c.code = upper(btrim(p_code)) and s.token = btrim(p_token) and s.subscriber = auth.uid();
end $$;

revoke all on function public.subscribe_channel(text, text), public.unsubscribe_channel(text, text) from public, anon;
grant execute on function public.subscribe_channel(text, text), public.unsubscribe_channel(text, text) to authenticated;

-- حذف البيانات يشمل الاشتراكات
create or replace function public.delete_my_data()
returns json language plpgsql volatile security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  n_bookings int; n_checkins int; n_pages int; n_sessions int; n_channels int; n_subs int;
begin
  if me is null then raise exception 'not_signed_in'; end if;
  delete from bookings where student = me;               get diagnostics n_bookings = row_count;
  delete from checkins where device = me;                get diagnostics n_checkins = row_count;
  delete from channel_subscribers where subscriber = me; get diagnostics n_subs = row_count;
  delete from office_hours_pages where owner = me;       get diagnostics n_pages = row_count;
  delete from attendance_sessions where owner = me;      get diagnostics n_sessions = row_count;
  delete from section_channels where owner = me;         get diagnostics n_channels = row_count;
  return json_build_object('bookings', n_bookings, 'checkins', n_checkins, 'subscriptions', n_subs, 'pages', n_pages, 'sessions', n_sessions, 'channels', n_channels);
end $$;
revoke all on function public.delete_my_data() from public, anon;
grant execute on function public.delete_my_data() to authenticated;

-- ما تحتاجه دالة الإرسال على الخادم (تستدعيها بمفتاح الخدمة فقط): اسم المادة وعناوين المشتركين
create or replace function public.post_push_targets(p_post uuid)
returns json language sql stable security definer set search_path = public as $$
  select json_build_object(
    'code', c.code, 'course_name', c.course_name, 'instructor', c.instructor, 'body', p.body,
    'tokens', coalesce((select json_agg(s.token) from channel_subscribers s where s.channel_id = c.id), '[]'::json)
  )
  from section_posts p join section_channels c on c.id = p.channel_id where p.id = p_post;
$$;
revoke all on function public.post_push_targets(uuid) from public, anon, authenticated;

-- تنظيف العناوين التي أبلغت Expo أنها لم تعد مسجلة (يستدعيها الخادم فقط)
create or replace function public.drop_push_tokens(p_tokens text[])
returns void language sql volatile security definer set search_path = public as $$
  delete from channel_subscribers where token = any(p_tokens);
$$;
revoke all on function public.drop_push_tokens(text[]) from public, anon, authenticated;

-- دالة الإرسال على الخادم تعمل بدور service_role (موجود في Supabase)
do $$ begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant execute on function public.post_push_targets(uuid), public.drop_push_tokens(text[]) to service_role;
  end if;
end $$;
