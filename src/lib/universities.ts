/**
 * الجامعات السعودية وأنظمة التعلم الإلكتروني (LMS).
 * الربط يتم عبر «رابط التقويم» الذي يعطيه النظام نفسه للطالب (iCal)، فيعمل مع أي جامعة تستخدم
 * Blackboard أو Moodle أو Canvas أو D2L Brightspace، دون كلمة مرور ودون اتفاقية مع الجامعة.
 */
import { UNIVERSITY_DOMAINS } from './accounts';

export type Lms = 'blackboard' | 'moodle' | 'canvas' | 'd2l' | 'other';

export const LMS_INFO: Record<Lms, { name: string; steps: string[] }> = {
  blackboard: {
    name: 'Blackboard',
    steps: ['افتح Blackboard من المتصفح، ثم «التقويم».', 'اضغط أيقونة الإعدادات أو «مشاركة التقويم»، ثم انسخ الرابط.', 'الصق الرابط هنا واضغط «استيراد».'],
  },
  moodle: {
    name: 'Moodle',
    steps: ['افتح Moodle من المتصفح، ثم «التقويم».', 'اضغط «استيراد أو تصدير التقويمات» ثم «تصدير التقويم».', 'اختر «كل الأحداث» و«الأيام الـ 60 القادمة»، ثم «الحصول على رابط التقويم» وانسخه.', 'الصق الرابط هنا واضغط «استيراد».'],
  },
  canvas: {
    name: 'Canvas',
    steps: ['افتح Canvas من المتصفح، ثم «التقويم».', 'اضغط «موجز التقويم» (Calendar Feed) أسفل الصفحة وانسخ الرابط.', 'الصق الرابط هنا واضغط «استيراد».'],
  },
  d2l: {
    name: 'D2L Brightspace',
    steps: ['افتح Brightspace من المتصفح، ثم «التقويم».', 'اضغط «اشتراك» (Subscribe) وانسخ رابط التقويم.', 'الصق الرابط هنا واضغط «استيراد».'],
  },
  other: {
    name: 'نظام آخر',
    steps: ['أي نظام أو تقويم (Outlook، Google) يعطيك رابط iCal ينتهي غالباً بـ ‎.ics.', 'انسخ الرابط والصقه هنا واضغط «استيراد».'],
  },
};

export const LMS_ORDER: Lms[] = ['blackboard', 'moodle', 'canvas', 'd2l', 'other'];

/** يتعرّف على نظام التعلم من شكل رابط التقويم. */
export function detectLms(url: string): Lms | null {
  const u = url.trim().toLowerCase();
  if (!u) return null;
  if (u.includes('/webapps/calendar') || u.includes('calendarfeed') || u.includes('blackboard')) return 'blackboard';
  if (u.includes('export_execute.php') || u.includes('/calendar/export') || u.includes('moodle')) return 'moodle';
  if (u.includes('/feeds/calendars/') || u.includes('instructure.com')) return 'canvas';
  if (u.includes('/d2l/') || u.includes('brightspace')) return 'd2l';
  return 'other';
}

/** اسم يظهر للتقويم المرتبط: «Moodle · lms.example.edu.sa». */
export function feedLabel(url: string): string {
  let host = url;
  try {
    host = new URL(url).hostname;
  } catch {}
  const lms = detectLms(url);
  return lms && lms !== 'other' ? `${LMS_INFO[lms].name} · ${host}` : host;
}

/** الجامعات السعودية الحكومية والأهلية الرئيسية (للاختيار السريع في الملف الشخصي). */
export const UNIVERSITIES = [
  'جامعة أم القرى',
  'جامعة الملك سعود',
  'جامعة الملك عبدالعزيز',
  'جامعة الإمام محمد بن سعود الإسلامية',
  'جامعة الملك فهد للبترول والمعادن',
  'جامعة الأميرة نورة بنت عبدالرحمن',
  'جامعة الملك خالد',
  'جامعة القصيم',
  'جامعة طيبة',
  'جامعة الطائف',
  'جامعة الملك فيصل',
  'جامعة الإمام عبدالرحمن بن فيصل',
  'جامعة جدة',
  'جامعة جازان',
  'جامعة حائل',
  'جامعة الجوف',
  'جامعة تبوك',
  'جامعة الباحة',
  'جامعة نجران',
  'جامعة الحدود الشمالية',
  'جامعة الأمير سطام بن عبدالعزيز',
  'جامعة المجمعة',
  'جامعة شقراء',
  'جامعة بيشة',
  'جامعة حفر الباطن',
  'الجامعة الإسلامية بالمدينة المنورة',
  'الجامعة السعودية الإلكترونية',
  'جامعة الملك سعود بن عبدالعزيز للعلوم الصحية',
  'جامعة الملك عبدالله للعلوم والتقنية',
  'جامعة الفيصل',
  'جامعة الأمير سلطان',
  'جامعة الأمير محمد بن فهد',
  'جامعة اليمامة',
  'جامعة دار الحكمة',
  'جامعة عفت',
  'جامعة الأعمال والتكنولوجيا',
  'جامعة المعرفة',
  'جامعة رياض العلم',
];

const norm = (s: string) =>
  s
    .replace(/[ً-ْـ]/g, '')
    .replace(/[أإآ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .replace(/^ال|\sال/g, ' ')
    .replace(/جامعه/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();

/** اختصارات إنجليزية شائعة غير ظاهرة في النطاق. */
const EXTRA_ABBR: Record<string, string> = { imsiu: 'جامعة الإمام محمد بن سعود الإسلامية', iu: 'الجامعة الإسلامية بالمدينة المنورة' };

/** اقتراحات الجامعات لما يكتبه المستخدم (تتجاهل «جامعة» و«ال» والهمزات، وتقبل الاختصار: UQU، KSU، KFUPM). */
export function searchUniversities(q: string, limit = 4): string[] {
  const n = norm(q);
  if (n.length < 2) return [];
  if (UNIVERSITIES.includes(q.trim())) return [];
  if (/^[a-z-]+$/.test(n)) {
    const byAbbr = [
      ...Object.entries(UNIVERSITY_DOMAINS).map(([d, u]) => [d.split('.')[0], u] as const),
      ...Object.entries(EXTRA_ABBR),
    ]
      .filter(([a]) => a.startsWith(n))
      .sort((a, b) => a[0].length - b[0].length)
      .map(([, u]) => u);
    return [...new Set(byAbbr)].slice(0, limit);
  }
  const words = n.split(' ');
  // كل كلمة مكتوبة تطابق بداية كلمة في اسم الجامعة («نوره» لا تطابق «المنورة»)
  return UNIVERSITIES.filter((u) => {
    const hw = norm(u).split(' ');
    return words.every((w) => hw.some((h) => h.startsWith(w)));
  }).slice(0, limit);
}
