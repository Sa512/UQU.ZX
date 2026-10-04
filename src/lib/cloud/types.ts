import type { Window } from '../officeHours';
import type { AccountRole, AccountStatus, ExportRow, Profile } from '../accounts';

export type PageInfo = { id: string; title: string; host_name: string; slot_minutes: number; is_open: boolean; windows: Window[]; taken: string[] };
export type Booking = { id: string; page_id: string; starts_at: string; ends_at: string; student_name: string; uni_id: string; topic: string; status: 'booked' | 'cancelled'; cancelled_by?: 'student' | 'host' | null; cancel_note?: string };
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
export type AdminOverview = { students: number; professors: number; pending: number; new_week: number; active_week: number; open_pages: number; bookings_week: number; errors_week?: number; universities: { university: string; users: number }[] };
export type AdminRules = { domains: { domain: string; university: string; kind: 'student' | 'staff' }[]; overrides: { email: string; role: AccountRole | null; is_admin: boolean; note: string }[] };

export type AdminLogEntry = { admin_email: string; action: string; target: string; at: string };
/** معلومات النسخة السحابية (دون محتواها). */
export type BackupInfo = { updated_at: string; size: number; device: string };
export type BackupDevice = '' | 'iPhone' | 'iPad' | 'Android' | 'web';
/** التقرير الشهري للمشرف. */
export type AdminReport = {
  month: string;
  new_students: number;
  new_professors: number;
  total_users: number;
  active_users: number;
  bookings: number;
  cancelled_by_host: number;
  cancelled_by_student: number;
  checkins: number;
  posts: number;
  backups: number;
  errors: number;
  universities: { university: string; users: number }[];
  weeks: { week: string; signups: number }[];
};
/** التحكم الطارئ عن بُعد (يقرؤه التطبيق قبل الدخول أيضاً). */
export type AppFeature = 'booking' | 'checkin' | 'channels' | 'backup';
export type AppConfig = {
  min_version: string;
  latest_version: string;
  maintenance: boolean;
  maintenance_message: string;
  banner: string;
  banner_level: 'info' | 'warning';
  disabled_features: AppFeature[];
  ios_url: string;
  updated_at: string;
};
/** عطل متكرر (مجمّع، بلا هوية المستخدم). */
export type AdminError = { message: string; screen: string; app_version: string; count: number; last_at: string };

export interface CloudApi {
  /** true = خادم Supabase حقيقي، false = وضع تجريبي على هذا الجهاز. */
  readonly real: boolean;
  publishPage(p: { id?: string; title: string; host_name: string; slot_minutes: number; windows: Window[] }): Promise<{ id: string; code: string }>;
  setPageOpen(id: string, open: boolean): Promise<void>;
  getPage(code: string): Promise<PageInfo | null>;
  pageBookings(pageId: string): Promise<Booking[]>;
  book(code: string, startsAt: string, name: string, uniId: string, topic: string): Promise<string>;
  myBookings(): Promise<Booking[]>;
  /** note: سبب الإلغاء (يُحفظ فقط إن ألغى الدكتور، ويصل للطالب). */
  cancel(id: string, note?: string): Promise<void>;
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
  /** يعيد إرسال رمز تأكيد التسجيل (لحساب لم يتأكد بعد). */
  resendSignupCode(email: string): Promise<void>;
  signIn(email: string, password: string): Promise<void>;
  sendReset(email: string): Promise<void>;
  resetPassword(email: string, code: string, password: string): Promise<void>;
  /** global = إنهاء الجلسة على كل الأجهزة. */
  signOut(global?: boolean): Promise<void>;
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
  /** سجل إجراءات المشرفين (الأحدث أولاً). */
  adminLog(): Promise<AdminLogEntry[]>;
  unsubscribeChannel(code: string, token: string): Promise<void>;
  /** الدكتور يسجّل جهازه لإشعارات الحجوزات الجديدة. */
  registerHostPush(token: string): Promise<void>;
  unregisterHostPush(token: string): Promise<void>;
  /** الطالب يسجّل جهازه ليصله إشعار إن ألغى الدكتور موعده. */
  registerStudentPush(token: string): Promise<void>;
  /** بلاغ عطل مجهول الهوية (النص منقّى مسبقاً). */
  reportError(version: string, platform: 'ios' | 'android' | 'web', screen: string, message: string): Promise<void>;
  adminErrors(): Promise<AdminError[]>;
  // ——— النسخة السحابية المشفّرة (الخادم يقبل الملف المشفّر فقط) ———
  saveBackup(encrypted: string, device: BackupDevice): Promise<BackupInfo>;
  backupInfo(): Promise<BackupInfo | null>;
  /** النص المشفّر كما رُفع، أو null. */
  getBackup(): Promise<{ blob: string; updated_at: string } | null>;
  deleteBackup(): Promise<void>;
  /** month بصيغة YYYY-MM. */
  adminReport(month: string): Promise<AdminReport>;
  // ——— التحكم الطارئ ———
  getAppConfig(): Promise<AppConfig | null>;
  adminSetAppConfig(c: Omit<AppConfig, 'updated_at'>): Promise<AppConfig>;
}
