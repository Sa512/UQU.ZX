/**
 * وضع تجريبي: يحاكي الخادم على هذا الجهاز بنفس قواعد قاعدة البيانات
 * (صلاحية الموعد، التعارض، حد الحجوزات، انتهاء رمز QR، منع التكرار)
 * حتى يمكن تجربة الحجز والتحضير قبل ربط Supabase.
 */
import { generateSlots, type Window } from '../officeHours';
import { CloudError } from './errors';
import type { Booking, CheckIn, CloudApi, PageInfo } from './types';

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const code = (n: number) => Array.from({ length: n }, () => ALPHABET[Math.floor(Math.random() * ALPHABET.length)]).join('');
const id = () => Math.random().toString(36).slice(2) + Date.now().toString(36);
const delay = <T>(v: T) => new Promise<T>((r) => setTimeout(() => r(v), 250));

type Page = { id: string; code: string; title: string; host_name: string; slot_minutes: number; is_open: boolean; windows: Window[] };
type Sess = { id: string; code: string; label: string; nonce: string; nonce_prev: string | null; nonce_at: number; open: boolean; checkins: CheckIn[]; devices: Set<string> };

/** تخزين اختياري لحفظ صفحات الحجز والحجوزات بين مرات فتح التطبيق. */
export type DemoStorage = { getItem(k: string): Promise<string | null>; setItem(k: string, v: string): Promise<void> };
const KEY = 'mudhaker-demo-cloud';

export function createDemoApi(now: () => number = Date.now, device = 'this-device', storage?: DemoStorage): CloudApi {
  const pages = new Map<string, Page>();
  const bookings: (Booking & { student: string })[] = [];
  const sessions = new Map<string, Sess>();
  const ready = storage
    ? storage
        .getItem(KEY)
        .then((raw) => {
          if (!raw) return;
          const d = JSON.parse(raw) as { pages: Page[]; bookings: (Booking & { student: string })[] };
          d.pages.forEach((p) => pages.set(p.id, p));
          bookings.push(...d.bookings);
        })
        .catch(() => {})
    : Promise.resolve();
  const save = () => storage?.setItem(KEY, JSON.stringify({ pages: [...pages.values()], bookings })).catch(() => {});
  const byCode = <T extends { code: string }>(m: Map<string, T>, c: string) => [...m.values()].find((x) => x.code === c.trim().toUpperCase());

  return {
    real: false,
    async publishPage({ id: pid, title, host_name, slot_minutes, windows }) {
      await ready;
      const existing = pid ? pages.get(pid) : undefined;
      const p: Page = existing
        ? { ...existing, title, host_name, slot_minutes, windows }
        : { id: id(), code: code(6), title, host_name, slot_minutes, is_open: true, windows };
      await ready;
      pages.set(p.id, p);
      save();
      return delay({ id: p.id, code: p.code });
    },
    async setPageOpen(pid, open) {
      await ready;
      const p = pages.get(pid);
      if (p) p.is_open = open;
      save();
      await delay(null);
    },
    async getPage(c) {
      await ready;
      const p = byCode(pages, c);
      if (!p) return delay(null);
      const taken = bookings.filter((b) => b.page_id === p.id && b.status === 'booked' && new Date(b.starts_at).getTime() > now()).map((b) => b.starts_at);
      const info: PageInfo = { id: p.id, title: p.title, host_name: p.host_name, slot_minutes: p.slot_minutes, is_open: p.is_open, windows: p.windows, taken };
      return delay(info);
    },
    async pageBookings(pid) {
      await ready;
      return delay(bookings.filter((b) => b.page_id === pid && b.status === 'booked' && new Date(b.starts_at).getTime() > now()).sort((a, b) => a.starts_at.localeCompare(b.starts_at)));
    },
    async book(c, startsAt, name, uniId, topic) {
      await ready;
      const p = byCode(pages, c);
      if (!p) throw new CloudError('page_not_found');
      if (!p.is_open) throw new CloudError('page_closed');
      const t = new Date(startsAt).getTime();
      if (t <= now()) throw new CloudError('slot_in_past');
      if (t > now() + 21 * 86_400_000) throw new CloudError('slot_too_far');
      const valid = generateSlots(p.windows, p.slot_minutes, [], now(), 22).some((s) => new Date(s.startsAt).getTime() === t);
      if (!valid) throw new CloudError('slot_invalid');
      const active = bookings.filter((b) => b.page_id === p.id && b.student === device && b.status === 'booked' && new Date(b.starts_at).getTime() > now());
      if (active.length >= 2) throw new CloudError('too_many_bookings');
      if (bookings.some((b) => b.page_id === p.id && b.status === 'booked' && new Date(b.starts_at).getTime() === t)) throw new CloudError('slot_taken');
      const b = { id: id(), page_id: p.id, student: device, starts_at: new Date(t).toISOString(), ends_at: new Date(t + p.slot_minutes * 60_000).toISOString(), student_name: name.trim(), uni_id: uniId.trim(), topic: topic.trim(), status: 'booked' as const };
      bookings.push(b);
      save();
      return delay(b.id);
    },
    async myBookings() {
      await ready;
      return delay(bookings.filter((b) => b.student === device));
    },
    async cancel(bid) {
      await ready;
      const b = bookings.find((x) => x.id === bid && x.status === 'booked');
      if (!b) throw new CloudError('not_allowed');
      b.status = 'cancelled';
      save();
      await delay(null);
    },
    async startSession(label) {
      const s: Sess = { id: id(), code: code(6), label, nonce: code(8), nonce_prev: null, nonce_at: now(), open: true, checkins: [], devices: new Set() };
      sessions.set(s.id, s);
      return delay({ id: s.id, code: s.code, nonce: s.nonce });
    },
    async rotate(sid) {
      const s = sessions.get(sid);
      if (!s || !s.open) throw new CloudError('not_allowed');
      s.nonce_prev = s.nonce;
      s.nonce = code(8);
      s.nonce_at = now();
      return delay(s.nonce);
    },
    async checkins(sid) {
      return delay([...(sessions.get(sid)?.checkins ?? [])]);
    },
    async closeSession(sid) {
      const s = sessions.get(sid);
      if (s) s.open = false;
      await delay(null);
    },
    async checkIn(c, nonce, uniId, name) {
      const s = byCode(sessions, c);
      if (!s) throw new CloudError('session_not_found');
      if (!s.open) throw new CloudError('session_closed');
      const age = now() - s.nonce_at;
      const n = nonce.trim().toUpperCase();
      const ok = (n === s.nonce && age <= 30_000) || (s.nonce_prev !== null && n === s.nonce_prev && age <= 45_000);
      if (!ok) throw new CloudError('qr_expired');
      if (!/^\d{4,12}$/.test(uniId.trim())) throw new CloudError('unknown');
      // الوضع التجريبي على جهاز واحد: نسمح بعدة طلاب من الجهاز نفسه لتسهيل التجربة، ونمنع تكرار الرقم الجامعي
      if (s.checkins.some((x) => x.uni_id === uniId.trim())) throw new CloudError('uni_id_used');
      s.checkins.push({ id: id(), uni_id: uniId.trim(), student_name: name.trim(), at: new Date(now()).toISOString() });
      return delay({ label: s.label });
    },
  };
}
