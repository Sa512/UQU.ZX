/**
 * منطق إشعارات إعلانات القناة (بلا اعتماد على Deno، ليُختبر مع التطبيق):
 * بناء رسائل Expo، وتقسيمها دفعات، واستخراج العناوين الميتة من الردود.
 */
export type Targets = { code: string; course_name: string; instructor: string; body: string; tokens: string[] };
export type ExpoMessage = {
  to: string;
  title: string;
  body: string;
  sound: 'default';
  priority: 'high';
  channelId: 'announcements';
  data: { type: 'channel_post'; code: string };
};
export type ExpoTicket = { status: 'ok' | 'error'; id?: string; message?: string; details?: { error?: string } };

const clip = (s: string, n: number) => (s.length > n ? s.slice(0, n - 1).trimEnd() + '…' : s);

export function buildMessages(t: Targets): ExpoMessage[] {
  const tokens = [...new Set(t.tokens)].filter((x) => /^Expo(nent)?PushToken\[[A-Za-z0-9_-]{10,80}\]$/.test(x));
  const body = clip(`${t.instructor}: ${t.body.replace(/\s+/g, ' ').trim()}`, 160);
  return tokens.map((to) => ({ to, title: `📣 ${clip(t.course_name, 60)}`, body, sound: 'default', priority: 'high', channelId: 'announcements', data: { type: 'channel_post', code: t.code } }));
}

/** Expo يقبل حتى 100 رسالة في الطلب الواحد. */
export function chunk<T>(arr: T[], size = 100): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

/** العناوين التي أبلغ Expo أنها لم تعد مسجلة (حذف التطبيق مثلاً) تُحذف من القاعدة. */
export function deadTokens(messages: { to: string }[], tickets: ExpoTicket[]): string[] {
  return tickets.flatMap((t, i) => (t.status === 'error' && t.details?.error === 'DeviceNotRegistered' && messages[i] ? [messages[i].to] : []));
}

// ——— إشعار الدكتور بحجز جديد ———
export type BookingTargets = { title: string; student_name: string; starts_at: string; tokens: string[] };
export type BookingMessage = Omit<ExpoMessage, 'channelId' | 'data'> & { channelId: 'bookings'; data: { type: 'booking' } };

const DAYS = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];

/** «الأحد 10:30 ص» بتوقيت الرياض (UTC+3 ثابت، بلا توقيت صيفي). */
export function riyadhLabel(iso: string): string {
  const d = new Date(new Date(iso).getTime() + 3 * 3_600_000);
  const h = d.getUTCHours();
  const m = String(d.getUTCMinutes()).padStart(2, '0');
  return `${DAYS[d.getUTCDay()]} ${h % 12 || 12}:${m} ${h < 12 ? 'ص' : 'م'}`;
}

export function buildBookingMessages(t: BookingTargets): BookingMessage[] {
  const tokens = [...new Set(t.tokens)].filter((x) => /^Expo(nent)?PushToken\[[A-Za-z0-9_-]{10,80}\]$/.test(x));
  const body = clip(`${t.student_name.replace(/\s+/g, ' ').trim()} · ${riyadhLabel(t.starts_at)}`, 160);
  return tokens.map((to) => ({ to, title: `📅 حجز جديد · ${clip(t.title, 50)}`, body, sound: 'default', priority: 'high', channelId: 'bookings', data: { type: 'booking' } }));
}
