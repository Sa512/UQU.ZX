// Supabase Edge Function (Deno): إشعار الدكتور عند كل حجز جديد في ساعاته المكتبية.
// التفعيل: Database Webhook على جدول bookings (INSERT) يستدعي هذه الدالة مع ترويسة x-webhook-secret.
// المتغيرات: WEBHOOK_SECRET (نفس دالة الإعلانات)، و(اختياري) EXPO_ACCESS_TOKEN.
import { createClient } from 'jsr:@supabase/supabase-js@2';
import { buildBookingMessages, chunk, deadTokens, type BookingTargets, type ExpoTicket } from '../_shared/push.ts';

Deno.serve(async (req: Request) => {
  const secret = Deno.env.get('WEBHOOK_SECRET');
  if (!secret || req.headers.get('x-webhook-secret') !== secret) return new Response('forbidden', { status: 403 });

  const payload = await req.json().catch(() => null);
  if (payload?.type !== 'INSERT' || payload?.table !== 'bookings' || typeof payload?.record?.id !== 'string') return new Response('ignored');

  const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  const { data, error } = await sb.rpc('booking_push_targets', { p_booking: payload.record.id });
  if (error || !data) return new Response('no targets', { status: error ? 500 : 200 });

  const messages = buildBookingMessages(data as BookingTargets);
  const token = Deno.env.get('EXPO_ACCESS_TOKEN');
  const dead: string[] = [];
  for (const batch of chunk(messages)) {
    const res = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify(batch),
    });
    if (!res.ok) continue;
    const json = (await res.json().catch(() => ({}))) as { data?: ExpoTicket[] };
    dead.push(...deadTokens(batch, json.data ?? []));
  }
  if (dead.length) await sb.rpc('drop_push_tokens', { p_tokens: dead });
  return new Response(JSON.stringify({ sent: messages.length, dropped: dead.length }), { headers: { 'Content-Type': 'application/json' } });
});
