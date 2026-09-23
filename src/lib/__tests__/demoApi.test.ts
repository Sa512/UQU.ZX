import { describe, expect, it } from '@jest/globals';
import { createDemoApi } from '../cloud/demoApi';

// الإثنين 5 أكتوبر 2026، 09:00 بتوقيت الرياض
let t = Date.UTC(2026, 9, 5, 6, 0);
const now = () => t;
const windows = [{ weekday: 1, start_min: 600, end_min: 660, location: 'مكتب 3' }];

describe('demo cloud mirrors server rules', () => {
  it('books, rejects conflicts and limits', async () => {
    const api = createDemoApi(now);
    const { code } = await api.publishPage({ title: 'ساعات', host_name: 'د. سارة', slot_minutes: 15, windows });
    await api.book(code, '2026-10-05T10:00:00+03:00', 'سارة', '443001122', '');
    await expect(api.book(code, '2026-10-05T10:00:00+03:00', 'نورة', '1', '')).rejects.toMatchObject({ code: 'slot_taken' });
    await expect(api.book(code, '2026-10-05T10:07:00+03:00', 'نورة', '1', '')).rejects.toMatchObject({ code: 'slot_invalid' });
    await api.book(code, '2026-10-05T10:15:00+03:00', 'سارة', '443001122', '');
    await expect(api.book(code, '2026-10-05T10:30:00+03:00', 'سارة', '443001122', '')).rejects.toMatchObject({ code: 'too_many_bookings' });
    expect((await api.getPage(code.toLowerCase()))?.taken).toHaveLength(2);
    await expect(api.getPage('ZZZZZZ')).resolves.toBeNull();
  });

  it('expires QR nonces like the server', async () => {
    const api = createDemoApi(now);
    const s = await api.startSession('هياكل · 1041');
    await expect(api.checkIn(s.code, 'WRONG123', '443001122', 'سارة')).rejects.toMatchObject({ code: 'qr_expired' });
    await api.checkIn(s.code, s.nonce, '443001122', 'سارة');
    await expect(api.checkIn(s.code, s.nonce, '443001122', 'سارة')).rejects.toMatchObject({ code: 'uni_id_used' });
    const n2 = await api.rotate(s.id);
    await api.checkIn(s.code, s.nonce, '443001133', 'نورة'); // السابق مقبول فوراً بعد التجديد
    t += 50_000;
    await expect(api.checkIn(s.code, n2, '443001144', 'ريم')).rejects.toMatchObject({ code: 'qr_expired' });
    expect((await api.checkins(s.id)).map((c) => c.uni_id)).toEqual(['443001122', '443001133']);
    await api.closeSession(s.id);
    await expect(api.checkIn(s.code, n2, '443001155', 'هند')).rejects.toMatchObject({ code: 'session_closed' });
  });
});

describe('demo persistence', () => {
  it('keeps pages and bookings across restarts', async () => {
    const mem = new Map<string, string>();
    const storage = { getItem: async (k: string) => mem.get(k) ?? null, setItem: async (k: string, v: string) => void mem.set(k, v) };
    const a = createDemoApi(now, 'd', storage);
    const { code } = await a.publishPage({ title: 'ساعات', host_name: 'د. سارة', slot_minutes: 15, windows });
    t = Date.UTC(2026, 9, 5, 6, 0);
    await a.book(code, '2026-10-05T10:45:00+03:00', 'سارة', '1', '');
    const b = createDemoApi(now, 'd', storage);
    expect((await b.getPage(code))?.taken).toHaveLength(1);
    expect(await b.myBookings()).toHaveLength(1);
    // إلغاء مباشرة بعد إعادة التشغيل (قبل أي قراءة أخرى)
    const c = createDemoApi(now, 'd', storage);
    await c.cancel((await b.myBookings())[0].id);
    expect((await createDemoApi(now, 'd', storage).getPage(code))?.taken).toHaveLength(0);
  });
});
