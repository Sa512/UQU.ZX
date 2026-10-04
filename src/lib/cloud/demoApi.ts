/**
 * وضع تجريبي: يحاكي الخادم على هذا الجهاز بنفس قواعد قاعدة البيانات
 * (صلاحية الموعد، التعارض، حد الحجوزات، انتهاء رمز QR، منع التكرار)
 * حتى يمكن تجربة الحجز والتحضير قبل ربط Supabase.
 */
import { generateSlots, type Window } from '../officeHours';
import { CloudError } from './errors';
import { sanitizeChannel } from '../sectionChannel';
import { CLOUD_BACKUP_MAX, CLOUD_BACKUP_RE } from '../backupCrypto';
import { cleanConfig, DEFAULT_CONFIG } from '../appConfig';
import type { AdminError, AdminReport, AppConfig, BackupInfo, AdminLogEntry, AdminUser, Booking, ChannelInput, ChannelPost, CheckIn, CloudApi, OfficeHost, PageInfo } from './types';
import { emailKind, normalizeEmail, type AccountRole, type Profile } from '../accounts';

/** رمز التحقق في الوضع التجريبي (لا يُرسل إيميل فعلي). */
export const DEMO_CODE = '123456';
/** المشرف في الوضع التجريبي (مثل الخادم: إيميل الدعم المعلن). */
export const DEMO_ADMIN = 'asd1911147@gmail.com';
type User = { id: string; email: string; password: string; verified: boolean; created_at: string; last_seen_at: string; profile: Profile | null };
/** دكاترة تجريبيون يظهرون في دليل الساعات المكتبية لأي جامعة، حتى تُجرَّب الميزة على جهاز واحد. */
const DEMO_HOSTS = [
  { code: 'DMSR01', name: 'د. فهد الزهراني', title: 'ساعات مكتبية · الفيزياء العامة', windows: [{ weekday: 0, start_min: 600, end_min: 720, location: 'مبنى 5 · مكتب 214' }, { weekday: 2, start_min: 600, end_min: 660, location: 'مبنى 5 · مكتب 214' }] },
  { code: 'DMKH02', name: 'د. خالد العتيبي', title: 'ساعات مكتبية · هياكل البيانات', windows: [{ weekday: 1, start_min: 780, end_min: 900, location: 'مبنى 3 · مكتب 110' }] },
  { code: 'DMNQ03', name: 'د. نورة القحطاني', title: 'ساعات مكتبية · مهارات الكتابة', windows: [{ weekday: 3, start_min: 540, end_min: 660, location: 'مبنى 1 · مكتب 8' }] },
];

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const code = (n: number) => Array.from({ length: n }, () => ALPHABET[Math.floor(Math.random() * ALPHABET.length)]).join('');
const id = () => Math.random().toString(36).slice(2) + Date.now().toString(36);
const delay = <T>(v: T) => new Promise<T>((r) => setTimeout(() => r(v), 250));

type Page = { id: string; code: string; title: string; host_name: string; slot_minutes: number; is_open: boolean; windows: Window[]; owner?: string };
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
  const users = new Map<string, User>();
  const adminLog: AdminLogEntry[] = [];
  const errors: AdminError[] = [];
  let appConfig: AppConfig = { ...DEFAULT_CONFIG, updated_at: new Date(now()).toISOString() };
  // النسخ السحابية: مفتاح منفصل (قد تكون كبيرة) — فشل الحفظ لا يمس باقي البيانات التجريبية
  const backups = new Map<string, { blob: string; updated_at: string; device: string }>();
  const BKEY = 'mudhaker-demo-backups';
  const backupsReady = storage
    ? storage
        .getItem(BKEY)
        .then((raw) => {
          if (raw) for (const [k, v] of Object.entries(JSON.parse(raw) as Record<string, { blob: string; updated_at: string; device: string }>)) backups.set(k, v);
        })
        .catch(() => {})
    : Promise.resolve();
  const saveBackups = () => storage?.setItem(BKEY, JSON.stringify(Object.fromEntries(backups))).catch(() => {});
  const logAdmin = (action: string, target: string) => adminLog.unshift({ admin_email: current ?? '?', action, target, at: stamp() });
  let current: string | null = null; // إيميل الجلسة
  const ready = storage
    ? storage
        .getItem(KEY)
        .then((raw) => {
          if (!raw) return;
          const d = JSON.parse(raw) as { pages: Page[]; bookings: (Booking & { student: string })[]; channels?: Channel[]; users?: User[]; current?: string | null; appConfig?: AppConfig };
          d.pages.forEach((p) => pages.set(p.id, p));
          d.users?.forEach((u) => users.set(u.email, u));
          current = d.current ?? null;
          if (d.appConfig) appConfig = d.appConfig;
          bookings.push(...d.bookings);
          d.channels?.forEach((c) => channels.set(c.id, c));
        })
        .catch(() => {})
    : Promise.resolve();
  const save = () => storage?.setItem(KEY, JSON.stringify({ pages: [...pages.values()], bookings, channels: [...channels.values()], users: [...users.values()], current, appConfig })).catch(() => {});
  const me = () => (current ? users.get(current) : undefined);
  const mustUser = () => {
    const u = me();
    if (!u) throw new CloudError('not_signed_in');
    return u;
  };
  const admin = () => {
    const u = mustUser();
    if (!u.profile?.is_admin) throw new CloudError('not_allowed');
    return u;
  };
  const stamp = () => new Date(now()).toISOString();
  const byCode = <T extends { code: string }>(m: Map<string, T>, c: string) => [...m.values()].find((x) => x.code === c.trim().toUpperCase());

  return {
    real: false,
    async publishPage({ id: pid, title, host_name, slot_minutes, windows }) {
      await ready;
      const existing = pid ? pages.get(pid) : undefined;
      const p: Page = existing
        ? { ...existing, title, host_name, slot_minutes, windows }
        : { id: id(), code: code(6), title, host_name, slot_minutes, is_open: true, windows, owner: me()?.id };
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
    async cancel(bid, note = '') {
      await ready;
      const b = bookings.find((x) => x.id === bid && x.status === 'booked');
      if (!b) throw new CloudError('not_allowed');
      const host = [...pages.values()].some((p) => p.id === b.page_id && !!p.owner && p.owner === me()?.id);
      b.status = 'cancelled';
      b.cancelled_by = host ? 'host' : 'student';
      b.cancel_note = host ? note.replace(/\s+/g, ' ').trim().slice(0, 120) : '';
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
    async registerHostPush() {
      await delay(null);
    },
    async unregisterHostPush() {
      await delay(null);
    },
    async registerStudentPush() {
      await delay(null);
    },
    async reportError(version, platform, screen, message) {
      errors.unshift({ message: message.slice(0, 300), screen: screen.slice(0, 80), app_version: version, count: 1, last_at: stamp() });
      errors.length = Math.min(errors.length, 50);
      await delay(null);
    },
    async adminErrors() {
      await ready;
      admin();
      return delay([...errors]);
    },
    async saveBackup(encrypted, device) {
      await ready;
      await backupsReady;
      const u = mustUser();
      if (encrypted.length > CLOUD_BACKUP_MAX || !CLOUD_BACKUP_RE.test(encrypted)) throw new CloudError('bad_backup');
      const b = { blob: encrypted, updated_at: stamp(), device };
      backups.set(u.id, b);
      saveBackups();
      return delay<BackupInfo>({ updated_at: b.updated_at, size: encrypted.length, device });
    },
    async backupInfo() {
      await ready;
      await backupsReady;
      const b = backups.get(mustUser().id);
      return delay<BackupInfo | null>(b ? { updated_at: b.updated_at, size: b.blob.length, device: b.device } : null);
    },
    async getBackup() {
      await ready;
      await backupsReady;
      const b = backups.get(mustUser().id);
      return delay(b ? { blob: b.blob, updated_at: b.updated_at } : null);
    },
    async deleteBackup() {
      await ready;
      backups.delete(mustUser().id);
      saveBackups();
      await delay(null);
    },
    async getAppConfig() {
      await ready;
      return delay({ ...appConfig });
    },
    async adminSetAppConfig(c) {
      await ready;
      admin();
      let clean: Omit<AppConfig, 'updated_at'>;
      try {
        clean = cleanConfig(c);
      } catch (e) {
        throw new CloudError((e as Error).message);
      }
      appConfig = { ...clean, updated_at: stamp() };
      save();
      logAdmin('app_config', `min ${clean.min_version} · latest ${clean.latest_version}${clean.maintenance ? ' · maintenance' : ''}`);
      return delay({ ...appConfig });
    },
    async adminReport(month) {
      await ready;
      admin();
      const inMonth = (iso: string) => iso.slice(0, 7) === month;
      const ps = [...users.values()].filter((u) => u.profile);
      const unis = new Map<string, number>();
      ps.filter((u) => inMonth(u.created_at)).forEach((u) => unis.set(u.profile!.university, (unis.get(u.profile!.university) ?? 0) + 1));
      logAdmin('report', month);
      return delay<AdminReport>({
        month,
        new_students: ps.filter((u) => u.profile!.role === 'student' && inMonth(u.created_at)).length,
        new_professors: ps.filter((u) => u.profile!.role === 'professor' && inMonth(u.created_at)).length,
        total_users: ps.filter((u) => u.created_at.slice(0, 7) <= month).length,
        active_users: ps.filter((u) => u.last_seen_at.slice(0, 7) >= month && u.created_at.slice(0, 7) <= month).length,
        bookings: bookings.length,
        cancelled_by_host: bookings.filter((b) => b.cancelled_by === 'host').length,
        cancelled_by_student: bookings.filter((b) => b.cancelled_by === 'student').length,
        checkins: [...sessions.values()].reduce((a, x) => a + x.checkins.length, 0),
        posts: [...channels.values()].reduce((a, c) => a + c.posts.filter((p) => inMonth(p.created_at)).length, 0),
        backups: [...backups.values()].filter((b) => inMonth(b.updated_at)).length,
        errors: errors.length,
        universities: [...unis].map(([university, n]) => ({ university, users: n })).sort((a, b) => b.users - a.users).slice(0, 10),
        weeks: [],
      });
    },
    async deleteMyData() {
      // الوضع التجريبي على جهاز واحد: كل البيانات تخص هذا الجهاز
      await ready;
      pages.clear();
      bookings.length = 0;
      sessions.clear();
      channels.clear();
      const u = me();
      if (u) backups.delete(u.id);
      saveBackups();
      save();
      await delay(null);
    },
    // ——— الحسابات: نفس قواعد الخادم (complete_profile) ———
    async signUp(email, password) {
      await ready;
      const e = normalizeEmail(email);
      if (password.length < 8) throw new CloudError('weak_password');
      const u = users.get(e);
      if (u?.verified) throw new CloudError('user_exists');
      users.set(e, { id: u?.id ?? id(), email: e, password, verified: false, created_at: stamp(), last_seen_at: stamp(), profile: null });
      save();
      await delay(null);
    },
    async resendSignupCode() {
      // الوضع التجريبي: الرمز ثابت (DEMO_CODE) ولا يُرسل بريد
      await delay(null);
    },
    async verifyEmail(email, c) {
      await ready;
      const u = users.get(normalizeEmail(email));
      if (!u || c.trim() !== DEMO_CODE) throw new CloudError('bad_code');
      u.verified = true;
      current = u.email;
      save();
      await delay(null);
    },
    async signIn(email, password) {
      await ready;
      const u = users.get(normalizeEmail(email));
      if (!u || u.password !== password) throw new CloudError('invalid_credentials');
      if (!u.verified) throw new CloudError('email_not_confirmed');
      current = u.email;
      save();
      await delay(null);
    },
    async sendReset(email) {
      await ready;
      await delay(users.has(normalizeEmail(email)));
    },
    async resetPassword(email, c, password) {
      await ready;
      const u = users.get(normalizeEmail(email));
      if (!u || c.trim() !== DEMO_CODE) throw new CloudError('bad_code');
      if (password.length < 8) throw new CloudError('weak_password');
      u.password = password;
      u.verified = true;
      current = u.email;
      save();
      await delay(null);
    },
    async signOut() {
      await ready;
      current = null;
      save();
    },
    async completeProfile(name, role: AccountRole, university) {
      await ready;
      const u = mustUser();
      const n = name.trim();
      if (n.length < 2 || n.length > 80) throw new CloudError('bad_name');
      const k = emailKind(u.email);
      const isAdmin = u.email === DEMO_ADMIN;
      if (k.kind === 'not_university' && !isAdmin) throw new CloudError('not_university_email');
      let status: Profile['status'] = 'active';
      if (role === 'professor' && !isAdmin) {
        if (k.kind === 'student') throw new CloudError('student_email');
        if (k.kind !== 'staff') status = 'pending';
      }
      const prev = u.profile;
      if (prev?.status === 'rejected' && role === 'professor') status = 'rejected';
      if (prev?.role === 'professor' && prev.status === 'active' && role === 'professor') status = 'active';
      u.profile = { id: u.id, email: u.email, full_name: n, university: (k.university ?? university.trim()).slice(0, 120), role, status, is_admin: prev?.is_admin ?? isAdmin };
      u.last_seen_at = stamp();
      save();
      return delay({ ...u.profile });
    },
    async myProfile() {
      await ready;
      const u = me();
      if (!u) return null;
      u.last_seen_at = stamp();
      return delay(u.profile ? { ...u.profile } : null);
    },
    async deleteAccount() {
      await ready;
      const u = mustUser();
      for (const [k, p] of pages) if (p.owner === u.id) pages.delete(k);
      users.delete(u.email);
      backups.delete(u.id);
      saveBackups();
      current = null;
      save();
      await delay(null);
    },
    async listOfficeHosts(query) {
      await ready;
      const u = mustUser();
      const uni = u.profile?.university;
      if (!u.profile) throw new CloudError('no_profile');
      // الدكاترة التجريبيون: صفحاتهم تُنشأ مرة واحدة بنفس الرموز فيعمل الحجز عليها
      for (const h of DEMO_HOSTS) {
        if (![...pages.values()].some((p) => p.code === h.code)) pages.set(`demo-${h.code}`, { id: `demo-${h.code}`, code: h.code, title: h.title, host_name: h.name, slot_minutes: 15, is_open: true, windows: h.windows, owner: `demo-${h.code}` });
      }
      const owners = new Map([...users.values()].filter((x) => x.profile).map((x) => [x.id, x.profile!]));
      const q = query.trim();
      const list: OfficeHost[] = [...pages.values()]
        .filter((p) => p.is_open)
        .map((p) => {
          const demo = DEMO_HOSTS.find((h) => `demo-${h.code}` === p.owner);
          const prof = p.owner ? owners.get(p.owner) : undefined;
          if (demo) return { code: p.code, title: p.title, host_name: demo.name, slot_minutes: p.slot_minutes };
          if (prof && prof.role === 'professor' && prof.status === 'active' && prof.university === uni && uni) return { code: p.code, title: p.title, host_name: prof.full_name, slot_minutes: p.slot_minutes };
          return null;
        })
        .filter((x): x is OfficeHost => !!x && (!q || x.host_name.includes(q) || x.title.includes(q)))
        .sort((a, b) => a.host_name.localeCompare(b.host_name, 'ar'));
      save();
      return delay(list);
    },
    async adminOverview() {
      await ready;
      admin();
      const ps = [...users.values()].map((u) => u.profile).filter((p): p is Profile => !!p);
      const week = now() - 7 * 86_400_000;
      const unis = new Map<string, number>();
      ps.forEach((p) => unis.set(p.university, (unis.get(p.university) ?? 0) + 1));
      return delay({
        students: ps.filter((p) => p.role === 'student').length,
        professors: ps.filter((p) => p.role === 'professor' && p.status === 'active').length,
        pending: ps.filter((p) => p.role === 'professor' && p.status === 'pending').length,
        new_week: [...users.values()].filter((u) => u.profile && Date.parse(u.created_at) > week).length,
        active_week: [...users.values()].filter((u) => u.profile && Date.parse(u.last_seen_at) > week).length,
        open_pages: [...pages.values()].filter((p) => p.is_open && !p.owner?.startsWith('demo-')).length,
        bookings_week: bookings.length,
        errors_week: errors.length,
        universities: [...unis].map(([university, n]) => ({ university, users: n })).sort((a, b) => b.users - a.users).slice(0, 10),
      });
    },
    async adminUsers(query, role, status) {
      await ready;
      admin();
      const q = query.trim();
      const rows: AdminUser[] = [...users.values()]
        .filter((u) => u.profile)
        .map((u) => ({ ...u.profile!, created_at: u.created_at, last_seen_at: u.last_seen_at }))
        .filter((p) => (!q || p.full_name.includes(q) || p.email.includes(q.toLowerCase()) || p.university.includes(q)) && (!role || p.role === role) && (!status || p.status === status))
        .sort((a, b) => Number(b.status === 'pending') - Number(a.status === 'pending') || b.created_at.localeCompare(a.created_at));
      return delay(rows);
    },
    async adminSetUser(uid, role, status) {
      await ready;
      admin();
      const u = [...users.values()].find((x) => x.id === uid && x.profile);
      if (!u?.profile) throw new CloudError('not_found');
      u.profile = { ...u.profile, role, status };
      logAdmin(`set_user:${role}/${status}`, u.email);
      if (!(role === 'professor' && status === 'active')) for (const p of pages.values()) if (p.owner === uid) p.is_open = false;
      save();
      await delay(null);
    },
    async adminExport() {
      await ready;
      admin();
      logAdmin('export', `${[...users.values()].filter((u) => u.profile).length} rows`);
      return delay(
        [...users.values()]
          .filter((u) => u.profile)
          .map((u) => ({ email: u.email, full_name: u.profile!.full_name, university: u.profile!.university, role: u.profile!.role, status: u.profile!.status, created_at: u.created_at, last_seen_at: u.last_seen_at, bookings: bookings.filter((b) => b.student === device).length, open_pages: [...pages.values()].filter((p) => p.owner === u.id && p.is_open).length })),
      );
    },
    async adminRules() {
      await ready;
      admin();
      return delay({ domains: [], overrides: [{ email: DEMO_ADMIN, role: null, is_admin: true, note: 'مالك التطبيق' }] });
    },
    async adminSetRule() {
      admin();
      await delay(null);
    },
    async adminSetOverride() {
      admin();
      await delay(null);
    },
    async adminLog() {
      await ready;
      admin();
      return delay(adminLog.slice(0, 50));
    },
    async deletePost(pid) {
      await ready;
      for (const ch of channels.values()) ch.posts = ch.posts.filter((p) => p.id !== pid);
      save();
      await delay(null);
    },
  };
}
