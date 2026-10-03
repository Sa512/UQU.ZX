import { describe, expect, it, jest } from '@jest/globals';
import { reconcileBookings, unseenCancellations } from '../bookingSync';
import { createDemoApi, DEMO_ADMIN, DEMO_CODE } from '../cloud/demoApi';
import { createReporter, scrubError } from '../errorScrub';
import type { MyBooking } from '@/store/useStore';

// الإثنين 5 أكتوبر 2026، 09:00 بتوقيت الرياض
const t = Date.UTC(2026, 9, 5, 6, 0);
const mk = (id: string, startsAt: string, status: MyBooking['status'] = 'booked'): MyBooking => ({ id, code: 'ABC234', title: 'ساعات', host: 'د. هند', startsAt, location: '', status });

describe('student bookings follow the server', () => {
  const local = [mk('a', '2026-10-06T07:30:00Z'), mk('b', '2026-10-07T07:30:00Z'), mk('c', '2026-10-08T07:30:00Z')];

  it('marks a professor cancellation with its reason, unseen', () => {
    const { next, changed } = reconcileBookings(local, [
      { id: 'a', status: 'cancelled', cancelled_by: 'host', cancel_note: ' اجتماع قسم ' },
      { id: 'b', status: 'booked' },
    ]);
    expect(changed).toBe(true);
    expect(next[0]).toMatchObject({ status: 'cancelled', cancelledBy: 'host', cancelNote: 'اجتماع قسم', noticeSeen: false });
    expect(next[1]).toBe(local[1]);
    // غير موجود على الخادم (حُذف مثلاً): يبقى كما هو
    expect(next[2]).toBe(local[2]);
    expect(unseenCancellations(next, t).map((b) => b.id)).toEqual(['a']);
    // الموعد الذي مضى لا يُنبَّه عنه
    expect(unseenCancellations(next, Date.parse('2026-10-06T08:00:00Z'))).toEqual([]);
  });

  it('a cancellation from another device of the student is silent', () => {
    const { next } = reconcileBookings(local, [{ id: 'b', status: 'cancelled', cancelled_by: 'student', cancel_note: 'x' }]);
    expect(next[1]).toMatchObject({ status: 'cancelled', cancelledBy: 'student', cancelNote: '', noticeSeen: true });
    expect(unseenCancellations(next, t)).toEqual([]);
  });

  it('reports no change when nothing moved', () => {
    expect(reconcileBookings(local, [{ id: 'a', status: 'booked' }]).changed).toBe(false);
    const done = [mk('a', '2026-10-06T07:30:00Z', 'cancelled')];
    expect(reconcileBookings(done, [{ id: 'a', status: 'cancelled', cancelled_by: 'host' }]).changed).toBe(false);
  });
});

describe('demo server records who cancelled', () => {
  it('professor cancels with a note; student cancel keeps none', async () => {
    const api = createDemoApi(() => t);
    await api.signUp('sm.harbi@uqu.edu.sa', 'secret123');
    await api.verifyEmail('sm.harbi@uqu.edu.sa', DEMO_CODE);
    await api.completeProfile('د. سارة الحربي', 'professor', '');
    const { id: pageId, code } = await api.publishPage({ title: 'ساعاتي', host_name: 'د. سارة', slot_minutes: 15, windows: [{ weekday: 1, start_min: 600, end_min: 660, location: '' }] });
    const b1 = await api.book(code, '2026-10-05T10:00:00+03:00', 'ريم', '', '');
    const b2 = await api.book(code, '2026-10-05T10:15:00+03:00', 'ريم', '', '');
    expect(await api.pageBookings(pageId)).toHaveLength(2);
    await api.cancel(b1, '  اجتماع   طارئ ');
    await api.signOut();
    await api.signUp('s441012345@st.uqu.edu.sa', 'secret123');
    await api.verifyEmail('s441012345@st.uqu.edu.sa', DEMO_CODE);
    await api.completeProfile('ريم', 'student', '');
    await api.cancel(b2, 'سبب خاص');
    const mine = await api.myBookings();
    expect(mine.find((b) => b.id === b1)).toMatchObject({ status: 'cancelled', cancelled_by: 'host', cancel_note: 'اجتماع طارئ' });
    expect(mine.find((b) => b.id === b2)).toMatchObject({ status: 'cancelled', cancelled_by: 'student', cancel_note: '' });
  });
});

describe('anonymous error reports', () => {
  it('scrubs emails, numbers, tokens and links', () => {
    expect(scrubError('TypeError: no user s441012345@st.uqu.edu.sa\nid 443001122 at https://x.supabase.co/rest/v1?a=b token eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9 ٤٤٣٠٠١')).toBe(
      'TypeError: no user [email] id [n] at [url] token [token] [n]',
    );
    expect(scrubError('ab '.repeat(200))).toHaveLength(300);
  });

  it('sends each error once and at most five per session', () => {
    const send = jest.fn((_s: string, _m: string) => Promise.resolve());
    const report = createReporter(send);
    expect(report(new TypeError('boom 4430011'), '/book')).toBe(true);
    expect(report(new TypeError('boom 4430099'), '/book')).toBe(false); // نفس الخطأ بعد التنقية
    expect(send).toHaveBeenCalledWith('/book', 'TypeError: boom [n]');
    for (let i = 0; i < 10; i++) report(`e${'abc'[i % 3]}${i}`);
    expect(send).toHaveBeenCalledTimes(5);
  });

  it('admin sees the reports in demo mode', async () => {
    const api = createDemoApi(() => t);
    await api.signUp(DEMO_ADMIN, 'secret123');
    await api.verifyEmail(DEMO_ADMIN, DEMO_CODE);
    await api.completeProfile('المشرف', 'student', '');
    await api.reportError('2.0.0', 'ios', '/book', 'TypeError: boom');
    expect(await api.adminErrors()).toMatchObject([{ message: 'TypeError: boom', screen: '/book', count: 1 }]);
    expect((await api.adminOverview()).errors_week).toBe(1);
  });
});
