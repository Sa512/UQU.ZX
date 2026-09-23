/** تصدير الجدول نصاً بصيغة يفهمها «استيراد الجدول» — للمشاركة مع زميل. */
import type { Course, Section, Slot } from '@/store/useStore';
import { DAY_NAMES } from './dates';
import { toCsv } from './csv';
import { SLOT_TYPES } from './labels';

// نكتب ص/م صراحة حتى لا يلتبس ٦ صباحاً بـ ٦ مساءً عند الاستيراد
const hhmm = (m: number) => {
  const h = Math.floor(m / 60) % 24;
  return `${h % 12 === 0 ? 12 : h % 12}:${String(m % 60).padStart(2, '0')} ${h < 12 ? 'ص' : 'م'}`;
};

export const SHARE_INTRO = 'جدولي من تطبيق مذاكر — انسخ الرسالة كاملة والصقها في «المزيد ← استيراد الجدول»:';

export function exportSchedule(slots: Slot[], courses: Course[], sections: Section[]): string {
  const rows = [['رمز المقرر', 'اسم المقرر', 'الشعبة', 'الأيام', 'الوقت', 'القاعة', 'النوع']];
  const sorted = [...slots].sort((a, b) => a.day - b.day || a.start - b.start);
  for (const s of sorted) {
    const c = courses.find((x) => x.id === s.courseId);
    const sec = s.sectionId ? sections.find((x) => x.id === s.sectionId) : undefined;
    rows.push([c?.code ?? '', c?.name ?? '', sec?.code ?? '', DAY_NAMES[s.day], `${hhmm(s.start)} - ${hhmm(s.end)}`, s.room, SLOT_TYPES[s.type].label]);
  }
  // CSV بفواصل لأن تطبيقات المراسلة قد تحوّل Tab إلى مسافات
  return toCsv(rows).replace(/^\uFEFF/, '');
}
