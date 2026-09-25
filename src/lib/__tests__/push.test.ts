import { describe, expect, it } from '@jest/globals';
import { buildMessages, chunk, deadTokens } from '../../../supabase/functions/_shared/push';

const t = { code: 'ABC234', course_name: 'هياكل البيانات', instructor: 'د. سارة', body: 'تأجّل  الاختبار\nللأحد', tokens: ['ExponentPushToken[abcdefghij1234567890]', 'ExponentPushToken[abcdefghij1234567890]', 'bad-token', 'ExpoPushToken[zyxwvutsrq0987654321]'] };

describe('channel announcement notifications', () => {
  it('builds one message per valid unique token with a readable body', () => {
    const m = buildMessages(t);
    expect(m.map((x) => x.to)).toEqual(['ExponentPushToken[abcdefghij1234567890]', 'ExpoPushToken[zyxwvutsrq0987654321]']);
    expect(m[0]).toMatchObject({ title: '📣 هياكل البيانات', body: 'د. سارة: تأجّل الاختبار للأحد', data: { type: 'channel_post', code: 'ABC234' } });
  });

  it('clips long announcements', () => {
    const m = buildMessages({ ...t, body: 'ا'.repeat(500) });
    expect(m[0].body.length).toBe(160);
    expect(m[0].body.endsWith('…')).toBe(true);
  });

  it('batches by 100 and finds tokens Expo says are gone', () => {
    expect(chunk(Array.from({ length: 250 }, (_, i) => i)).map((c) => c.length)).toEqual([100, 100, 50]);
    const m = buildMessages(t);
    expect(deadTokens(m, [{ status: 'ok', id: '1' }, { status: 'error', details: { error: 'DeviceNotRegistered' } }])).toEqual(['ExpoPushToken[zyxwvutsrq0987654321]']);
    expect(deadTokens(m, [{ status: 'error', details: { error: 'MessageRateExceeded' } }])).toEqual([]);
  });
});
