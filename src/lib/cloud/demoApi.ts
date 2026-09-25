/**
 * وضع تجريبي: يحاكي الخادم على هذا الجهاز بنفس قواعد قاعدة البيانات
 * (صلاحية الموعد، التعارض، حد الحجوزات، انتهاء رمز QR، منع التكرار)
 * حتى يمكن تجربة الحجز والتحضير قبل ربط Supabase.
 */
import { generateSlots, type Window } from '../officeHours';
import { CloudError } from './errors';
import { sanitizeChannel } from '../sectionChannel';
import type { Booking, ChannelInput, ChannelPost, CheckIn, CloudApi, PageInfo } from './types';

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const code = (n: number) => Array.from({ length: n }, () => ALPHABET[Math.floor(Math.random() * ALPHABET.length)]).join('');
const id = () => Math.random().toString(36).slice(2) + Date.now().toString(36);
const delay = <T>(v: T) => new Promise<T>((r) => setTimeout(() => r(v), 250));

type Page = { id: string; code: string; title: string; host_name: string; slot_minutes: number; is_open: boolean; windows: Window[] };
type Channel = ChannelInput & { id: string; code: string; updated_at: string; posts: ChannelPost[] };
type Sess = { id: string; code: string; label: string; nonce: string; nonce_prev: string | null; nonce_at: number; open: boolean; checkins: CheckIn[]; devices: Set<string> };

/** تخزين اختياري لحفظ صفحات الحجز والحجوزات بين مرات فتح التطبيق. */
export type DemoStorage = { getItem(k: string): Promise<string | null>; setItem(k: string, v: string): Promise<void> };
const KEY = 'mudhaker-demo-cloud';

export function createDemoApi(now: () => number = Date.now, device = 'this-device', storage?: DemoStorage): CloudApi {
  const pages = new Map<string, Page>();
  const bookings: (Booking & { student: string })[] = [];
  const sessions = new Map<string, Sess>();
  const channels = new Map<string, Channel>();
  const ready = storage
    ? storage
        .getItem(KEY)
        .then((raw) => {
          if (!raw) return;
          const d = JSON.parse(raw) as { pages: Page[]; bookings: (Booking & { student: string })[]; channels?: Channel[] };
          d.pages.forEach((p) => pages.set(p.id, p));
          bookings.push(...d.bookings);
          d.channels?.forEach((c) => channels.set(c.id, c));
        })
        .catch(() => {})
    : Promise.resolve();
  const save = () => storage?.setItem(KEY, JSON.stringify({ pages: [...pages.values()], bookings, channels: [...channels.values()] })).catch(() => {});
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
      // نفس نافذة الخادم: الحالي 20 ثانية من تجديده، والسابق 5 ثوانٍ بعد التجديد
      const ok = (n === s.nonce && age <= 20_000) || (s.nonce_prev !== null && n === s.nonce_prev && age <= 5_000);
      if (!ok) throw new CloudError('qr_expired');
      if (!/^\d{4,12}$/.test(uniId.trim())) throw new CloudError('unknown');
      // الوضع التجريبي على جهاز واحد: نسمح بعدة طلاب من الجهاز نفسه لتسهيل التجربة، ونمنع تكرار الرقم الجامعي
      if (s.checkins.some((x) => x.uni_id === uniId.trim())) throw new CloudError('uni_id_used');
      s.checkins.push({ id: id(), uni_id: uniId.trim(), student_name: name.trim(), at: new Date(now()).toISOString() });
      return delay({ label: s.label });
    },
    // قناة الشعبة: نفس قيود قاعدة البيانات (الأحجام، حد الإعلانات اليومي، آخر 20 إعلاناً)
    async publishSection({ id: cid, ...input }) {
      await ready;
      if (input.slots.length > 20 || input.exams.length > 30) throw new CloudError('unknown');
      const existing = cid ? channels.get(cid) : undefined;
      const stamp = new Date(now()).toISOString();
      const c: Channel = existing ? { ...existing, ...input, updated_at: stamp } : { ...input, id: id(), code: code(6), updated_at: stamp, posts: [] };
      channels.set(c.id, c);
      save();
      return delay({ id: c.id, code: c.code });
    },
    async getSection(c) {
      await ready;
      const ch = byCode(channels, c);
      return delay(ch ? sanitizeChannel({ ...ch, posts: ch.posts.slice(0, 20) }) : null);
    },
    async postToSection(cid, body) {
      await ready;
      const ch = channels.get(cid);
      if (!ch) throw new CloudError('not_allowed');
      const b = body.trim();
      if (!b || b.length > 500) throw new CloudError('unknown');
      if (ch.posts.filter((p) => now() - Date.parse(p.created_at) < 86_400_000).length >= 20) throw new CloudError('too_many_posts');
      const stamp = new Date(now()).toISOString();
      ch.posts.unshift({ id: id(), body: b, created_at: stamp });
      ch.updated_at = stamp;
      save();
      await delay(null);
    },
    // الوضع التجريبي بلا خادم إشعارات: الإعلان يصل عند فتح التطبيق
    async subscribeChannel() {
      await delay(null);
    },
    async unsubscribeChannel() {
      await delay(null);
    },
    async deleteMyData() {
      // الوضع التجريبي على جهاز واحد: كل البيانات تخص هذا الجهاز
      await ready;
      pages.clear();
      bookings.length = 0;
      sessions.clear();
      channels.clear();
      save();
      await delay(null);
    },
    async deletePost(pid) {
      await ready;
      for (const ch of channels.values()) ch.posts = ch.posts.filter((p) => p.id !== pid);
      save();
      await delay(null);
    },
  };
}
