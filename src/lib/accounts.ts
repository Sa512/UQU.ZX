/**
 * الحسابات بالإيميل الجامعي. نسخة التطبيق من منطق الخادم (email_kind في الهجرة 20260929) لتنبيه المستخدم مبكراً
 * وللوضع التجريبي؛ القرار النهائي دائماً للخادم.
 */
export type AccountRole = 'student' | 'professor';
export type AccountStatus = 'active' | 'pending' | 'rejected';
export type Profile = { id: string; email: string; full_name: string; university: string; role: AccountRole; status: AccountStatus; is_admin: boolean };
export type EmailKind = 'student' | 'staff' | 'unknown' | 'not_university';

/** النطاقات الأساسية للجامعات السعودية (منسوبون). مطابقة لما في الهجرة. */
export const UNIVERSITY_DOMAINS: Record<string, string> = {
  'uqu.edu.sa': 'جامعة أم القرى',
  'ksu.edu.sa': 'جامعة الملك سعود',
  'kau.edu.sa': 'جامعة الملك عبدالعزيز',
  'imamu.edu.sa': 'جامعة الإمام محمد بن سعود الإسلامية',
  'kfupm.edu.sa': 'جامعة الملك فهد للبترول والمعادن',
  'pnu.edu.sa': 'جامعة الأميرة نورة بنت عبدالرحمن',
  'kku.edu.sa': 'جامعة الملك خالد',
  'qu.edu.sa': 'جامعة القصيم',
  'taibahu.edu.sa': 'جامعة طيبة',
  'tu.edu.sa': 'جامعة الطائف',
  'kfu.edu.sa': 'جامعة الملك فيصل',
  'iau.edu.sa': 'جامعة الإمام عبدالرحمن بن فيصل',
  'uj.edu.sa': 'جامعة جدة',
  'jazanu.edu.sa': 'جامعة جازان',
  'uoh.edu.sa': 'جامعة حائل',
  'ju.edu.sa': 'جامعة الجوف',
  'ut.edu.sa': 'جامعة تبوك',
  'bu.edu.sa': 'جامعة الباحة',
  'nu.edu.sa': 'جامعة نجران',
  'nbu.edu.sa': 'جامعة الحدود الشمالية',
  'psau.edu.sa': 'جامعة الأمير سطام بن عبدالعزيز',
  'mu.edu.sa': 'جامعة المجمعة',
  'su.edu.sa': 'جامعة شقراء',
  'ub.edu.sa': 'جامعة بيشة',
  'uhb.edu.sa': 'جامعة حفر الباطن',
  'iu.edu.sa': 'الجامعة الإسلامية بالمدينة المنورة',
  'seu.edu.sa': 'الجامعة السعودية الإلكترونية',
  'ksau-hs.edu.sa': 'جامعة الملك سعود بن عبدالعزيز للعلوم الصحية',
  'kaust.edu.sa': 'جامعة الملك عبدالله للعلوم والتقنية',
  'alfaisal.edu': 'جامعة الفيصل',
  'psu.edu.sa': 'جامعة الأمير سلطان',
  'pmu.edu.sa': 'جامعة الأمير محمد بن فهد',
  'yu.edu.sa': 'جامعة اليمامة',
  'dah.edu.sa': 'جامعة دار الحكمة',
  'effatuniversity.edu.sa': 'جامعة عفت',
  'ubt.edu.sa': 'جامعة الأعمال والتكنولوجيا',
};

/** مطابق للاستثناء المزروع في الهجرة 20260929. */
export const OWNER_EMAILS = ['asd1911147@gmail.com'];

const STUDENT_SUB = new Set(['st', 'stu', 'std', 'student', 'students']);

export const normalizeEmail = (e: string) => e.trim().toLowerCase();
export const isEmail = (e: string) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(normalizeEmail(e));

export function emailKind(raw: string): { kind: EmailKind; university?: string } {
  const e = normalizeEmail(raw);
  const parts = e.split('@');
  if (parts.length !== 2 || !parts[0] || !parts[1]) return { kind: 'not_university' };
  const [local, dom] = parts;
  const base = Object.keys(UNIVERSITY_DOMAINS)
    .filter((d) => dom === d || dom.endsWith(`.${d}`))
    .sort((a, b) => b.length - a.length)[0];
  const university = base ? UNIVERSITY_DOMAINS[base] : undefined;
  if (base && dom !== base && STUDENT_SUB.has(dom.slice(0, dom.length - base.length - 1).split('.')[0])) return { kind: 'student', university };
  if (/^[a-z]?\d{7,}$/.test(local) && (base || dom.endsWith('.edu.sa'))) return { kind: 'student', university };
  if (base) return { kind: 'staff', university };
  if (dom.endsWith('.edu.sa')) return { kind: STUDENT_SUB.has(dom.split('.')[0]) ? 'student' : 'unknown' };
  return { kind: 'not_university' };
}

/** يتحقق قبل الإرسال للخادم ويعيد رسالة عربية واضحة، أو null إن كان مقبولاً. */
export function signupProblem(email: string, password: string, role: AccountRole): string | null {
  if (!isEmail(email)) return 'اكتب إيميلك الجامعي كاملاً.';
  const k = emailKind(email).kind;
  // إيميل المشرف (مالك التطبيق) مستثنى على الخادم؛ غيره من الاستثناءات يُنشأ من لوحة Supabase
  if (k === 'not_university' && !OWNER_EMAILS.includes(normalizeEmail(email))) return 'استخدم إيميلك الجامعي (ينتهي غالباً بـ edu.sa).';
  if (role === 'professor' && k === 'student') return 'هذا إيميل طالب. سجّل كطالب، أو استخدم إيميلك الوظيفي في الجامعة.';
  if (password.length < 8) return 'كلمة المرور 8 خانات على الأقل.';
  return null;
}

export const ROLE_LABEL: Record<AccountRole, string> = { student: 'طالب', professor: 'عضو هيئة تدريس' };
export const STATUS_LABEL: Record<AccountStatus, string> = { active: 'مفعّل', pending: 'بانتظار الموافقة', rejected: 'مرفوض' };

/** صفوف ملف Excel (CSV) لتصدير المستخدمين من لوحة المشرف. */
export type ExportRow = { email: string; full_name: string; university: string; role: AccountRole; status: AccountStatus; created_at: string; last_seen_at: string; bookings: number; open_pages: number };

export function usersCsv(rows: ExportRow[]): string {
  const esc = (v: string | number) => {
    const s = String(v ?? '');
    // يمنع حقن الصيغ في Excel (خلية تبدأ بـ = + - @)
    const safe = /^[=+\-@]/.test(s) ? `'${s}` : s;
    return /[",\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
  };
  const d = (iso: string) => (iso ? iso.slice(0, 16).replace('T', ' ') : '');
  const head = ['الاسم', 'الإيميل', 'الجامعة', 'الدور', 'الحالة', 'تاريخ التسجيل', 'آخر دخول', 'الحجوزات', 'صفحات حجز مفتوحة'];
  const lines = rows.map((r) => [r.full_name, r.email, r.university, ROLE_LABEL[r.role], STATUS_LABEL[r.status], d(r.created_at), d(r.last_seen_at), r.bookings, r.open_pages].map(esc).join(','));
  // BOM حتى يفتح Excel العربية صحيحة
  return '﻿' + [head.join(','), ...lines].join('\n');
}
