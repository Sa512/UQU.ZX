import { describe, expect, it } from '@jest/globals';
import { buildBookingMessages, buildCancelMessages, buildMessages, chunk, deadTokens, riyadhLabel } from '../../../supabase/functions/_shared/push';

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

describe('booking notifications for professors', () => {
  it('builds a short Riyadh-time message without private details', () => {
    const m = buildBookingMessages({ title: 'ساعات د. هند المكتبية', student_name: '  ريم   الشهري ', starts_at: '2026-10-06T07:30:00Z', tokens: ['ExponentPushToken[abcdefghijklmnop]', 'ExponentPushToken[abcdefghijklmnop]', 'bad'] });
    expect(m).toHaveLength(1);
    expect(m[0]).toMatchObject({ title: '📅 حجز جديد · ساعات د. هند المكتبية', body: 'ريم الشهري · الثلاثاء 10:30 ص', channelId: 'bookings', data: { type: 'booking' } });
    expect(riyadhLabel('2026-10-06T21:05:00Z')).toBe('الأربعاء 12:05 ص');
    expect(riyadhLabel('2026-10-06T10:00:00Z')).toBe('الثلاثاء 1:00 م');
  });
});

describe('cancellation notice for students', () => {
  it('tells the student who cancelled, when, and why', () => {
    const m = buildCancelMessages({ title: 'ساعات د. هند', host_name: 'د. هند الزهراني', starts_at: '2026-10-06T07:30:00Z', note: ' اجتماع   قسم\n', tokens: ['ExponentPushToken[abcdefghijklmnop]', 'nope'] });
    expect(m).toHaveLength(1);
    expect(m[0]).toMatchObject({
      title: '❌ د. هند الزهراني ألغى الموعد',
      body: 'موعدك الثلاثاء 10:30 ص أُلغي · اجتماع قسم. احجز موعداً آخر من التطبيق.',
      channelId: 'bookings',
      data: { type: 'booking_cancelled' },
    });
  });

  it('works without a note', () => {
    const [m] = buildCancelMessages({ title: 'x', host_name: 'د. هند', starts_at: '2026-10-06T07:30:00Z', note: '', tokens: ['ExponentPushToken[abcdefghijklmnop]'] });
    expect(m.body).toBe('موعدك الثلاثاء 10:30 ص أُلغي. احجز موعداً آخر من التطبيق.');
  });
});
