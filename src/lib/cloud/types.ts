import type { Window } from '../officeHours';
import type { AccountRole, AccountStatus, ExportRow, Profile } from '../accounts';

export type PageInfo = { id: string; title: string; host_name: string; slot_minutes: number; is_open: boolean; windows: Window[]; taken: string[] };
export type Booking = { id: string; page_id: string; starts_at: string; ends_at: string; student_name: string; uni_id: string; topic: string; status: 'booked' | 'cancelled' };
export type CheckIn = { id: string; uni_id: string; student_name: string; at: string };
export type Session = { id: string; code: string; nonce: string };

/** قناة الشعبة: ما ينشره الدكتور ويقرؤه الطلاب بالرمز. */
export type ChannelSlot = { weekday: number; start_min: number; end_min: number; type: 'lecture' | 'lab'; location: string };
export type ChannelExam = { title: string; date: string; type: 'exam' | 'quiz' | 'assignment' | 'project' };
export type ChannelPost = { id: string; body: string; created_at: string };
export type ChannelInput = {
  course_name: string;
  course_code: string;
  section_code: string;
  instructor: string;
  color: string;
  slots: ChannelSlot[];
  exams: ChannelExam[];
};
export type SectionChannel = ChannelInput & { id: string; code: string; updated_at: string; posts: ChannelPost[] };

/** دكتور فتح الحجز في جامعة الطالب (من دليل الساعات المكتبية). */
export type OfficeHost = { code: string; title: string; host_name: string; slot_minutes: number };
export type AdminUser = Profile & { created_at: string; last_seen_at: string };
export type AdminOverview = { students: number; professors: number; pending: number; new_week: number; active_week: number; open_pages: number; bookings_week: number; universities: { university: string; users: number }[] };
export type AdminRules = { domains: { domain: string; university: string; kind: 'student' | 'staff' }[]; overrides: { email: string; role: AccountRole | null; is_admin: boolean; note: string }[] };

export interface CloudApi {
  /** true = خادم Supabase حقيقي، false = وضع تجريبي على هذا الجهاز. */
  readonly real: boolean;
  publishPage(p: { id?: string; title: string; host_name: string; slot_minutes: number; windows: Window[] }): Promise<{ id: string; code: string }>;
  setPageOpen(id: string, open: boolean): Promise<void>;
  getPage(code: string): Promise<PageInfo | null>;
  pageBookings(pageId: string): Promise<Booking[]>;
  book(code: string, startsAt: string, name: string, uniId: string, topic: string): Promise<string>;
  myBookings(): Promise<Booking[]>;
  cancel(id: string): Promise<void>;
  startSession(label: string): Promise<Session>;
  rotate(sessionId: string): Promise<string>;
  checkins(sessionId: string): Promise<CheckIn[]>;
  closeSession(sessionId: string): Promise<void>;
  checkIn(code: string, nonce: string, uniId: string, name: string): Promise<{ label: string }>;
  publishSection(p: ChannelInput & { id?: string }): Promise<{ id: string; code: string }>;
  getSection(code: string): Promise<SectionChannel | null>;
  postToSection(channelId: string, body: string): Promise<void>;
  deletePost(postId: string): Promise<void>;
  /** يحذف كل ما يخص هذا المستخدم على الخادم (حق الحذف في نظام حماية البيانات الشخصية). */
  deleteMyData(): Promise<void>;
  subscribeChannel(code: string, token: string): Promise<void>;
  // ——— الحساب (الإيميل الجامعي) ———
  signUp(email: string, password: string): Promise<void>;
  /** يؤكد الإيميل بالرمز المرسل (6 أرقام) ويفتح الجلسة. */
  verifyEmail(email: string, code: string): Promise<void>;
  signIn(email: string, password: string): Promise<void>;
  sendReset(email: string): Promise<void>;
  resetPassword(email: string, code: string, password: string): Promise<void>;
  signOut(): Promise<void>;
  completeProfile(name: string, role: AccountRole, university: string): Promise<Profile>;
  myProfile(): Promise<Profile | null>;
  deleteAccount(): Promise<void>;
  listOfficeHosts(query: string): Promise<OfficeHost[]>;
  // ——— لوحة المشرف ———
  adminOverview(): Promise<AdminOverview>;
  adminUsers(query: string, role: AccountRole | null, status: AccountStatus | null): Promise<AdminUser[]>;
  adminSetUser(id: string, role: AccountRole, status: AccountStatus): Promise<void>;
  adminExport(): Promise<ExportRow[]>;
  adminRules(): Promise<AdminRules>;
  adminSetRule(domain: string, university: string, kind: 'student' | 'staff' | null): Promise<void>;
  adminSetOverride(email: string, role: AccountRole | null, admin: boolean, note: string): Promise<void>;
  unsubscribeChannel(code: string, token: string): Promise<void>;
}
