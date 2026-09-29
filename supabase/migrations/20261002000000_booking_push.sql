-- ============================================================================
-- مذاكر 1.9: إشعار فوري للدكتور عند كل حجز جديد في ساعاته المكتبية.
-- الدكتور يسجّل «عنوان إشعارات» جهازه (حتى 5 أجهزة)، وعند كل حجز تُرسل دالة الخادم (notify-booking)
-- إشعاراً: اسم الطالب ووقت الموعد. لا يُرسل الرقم الجامعي ولا موضوع الزيارة في الإشعار.
-- ============================================================================

create table public.host_push_tokens (
  owner uuid not null default auth.uid(),
  token text not null check (token ~ '^Expo(nent)?PushToken\[[A-Za-z0-9_-]{10,80}\]$'),
  -- clock_timestamp: ترتيب دقيق حتى داخل معاملة واحدة (لإبقاء أحدث 5 أجهزة)
  created_at timestamptz not null default clock_timestamp(),
  primary key (owner, token)
);
alter table public.host_push_tokens enable row level security;
revoke all on public.host_push_tokens from anon, authenticated;

create or replace function public.register_host_push(p_token text)
returns json language plpgsql volatile security definer set search_path = public as $$
begin
  perform throttle('host_push', 20, interval '1 hour');
  begin
    if not exists (select 1 from office_hours_pages where owner = auth.uid()) then raise exception 'not_allowed'; end if;
    insert into host_push_tokens (token) values (btrim(p_token)) on conflict do nothing;
    -- أحدث 5 أجهزة فقط
    delete from host_push_tokens where owner = auth.uid() and token not in
      (select token from host_push_tokens where owner = auth.uid() order by created_at desc limit 5);
    return json_build_object('ok', true);
  exception when others then
    return json_build_object('error', sqlerrm);
  end;
end $$;

create or replace function public.unregister_host_push(p_token text)
returns void language sql volatile security definer set search_path = public as $$
  delete from host_push_tokens where owner = auth.uid() and token = btrim(p_token)
$$;

revoke all on function public.register_host_push(text), public.unregister_host_push(text) from public, anon;
grant execute on function public.register_host_push(text), public.unregister_host_push(text) to authenticated;

-- لدالة الخادم فقط: بيانات الإشعار لحجز معيّن (الحجز القائم فقط)
create or replace function public.booking_push_targets(p_booking uuid)
returns json language sql stable security definer set search_path = public as $$
  select json_build_object(
    'title', p.title, 'student_name', b.student_name, 'starts_at', b.starts_at,
    'tokens', coalesce((select json_agg(t.token) from host_push_tokens t where t.owner = p.owner), '[]'::json)
  )
  from bookings b join office_hours_pages p on p.id = b.page_id where b.id = p_booking and b.status = 'booked';
$$;
revoke all on function public.booking_push_targets(uuid) from public, anon, authenticated;

-- العناوين الميتة تُحذف من الجدولين
create or replace function public.drop_push_tokens(p_tokens text[])
returns void language sql volatile security definer set search_path = public as $$
  delete from channel_subscribers where token = any(p_tokens);
  delete from host_push_tokens where token = any(p_tokens);
$$;
revoke all on function public.drop_push_tokens(text[]) from public, anon, authenticated;

do $$ begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant execute on function public.booking_push_targets(uuid), public.drop_push_tokens(text[]) to service_role;
  end if;
end $$;

-- حذف البيانات يشمل عناوين إشعارات الدكتور
create or replace function public.delete_my_data()
returns json language plpgsql volatile security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  n_bookings int; n_checkins int; n_pages int; n_sessions int; n_channels int; n_subs int; n_host int;
begin
  if me is null then raise exception 'not_signed_in'; end if;
  delete from bookings where student = me;               get diagnostics n_bookings = row_count;
  delete from checkins where device = me;                get diagnostics n_checkins = row_count;
  delete from channel_subscribers where subscriber = me; get diagnostics n_subs = row_count;
  delete from host_push_tokens where owner = me;         get diagnostics n_host = row_count;
  delete from office_hours_pages where owner = me;       get diagnostics n_pages = row_count;
  delete from attendance_sessions where owner = me;      get diagnostics n_sessions = row_count;
  delete from section_channels where owner = me;         get diagnostics n_channels = row_count;
  return json_build_object('bookings', n_bookings, 'checkins', n_checkins, 'subscriptions', n_subs + n_host, 'pages', n_pages, 'sessions', n_sessions, 'channels', n_channels);
end $$;
revoke all on function public.delete_my_data() from public, anon;
grant execute on function public.delete_my_data() to authenticated;
