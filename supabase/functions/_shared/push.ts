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
export function deadTokens(messages: ExpoMessage[], tickets: ExpoTicket[]): string[] {
  return tickets.flatMap((t, i) => (t.status === 'error' && t.details?.error === 'DeviceNotRegistered' && messages[i] ? [messages[i].to] : []));
}
