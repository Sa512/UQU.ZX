/** التقرير الشهري للمشرف: تسميات عربية وملف Excel (CSV) منه. منطق خالص. */
import type { AdminReport } from './cloud/types';

const MONTHS = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];

/** «YYYY-MM» للشهر الحالي (offset = 0) أو السابق (-1)… بتوقيت الجهاز. */
export function monthKey(now: Date, offset = 0): string {
  const d = new Date(now.getFullYear(), now.getMonth() + offset, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export const monthLabel = (key: string) => `${MONTHS[Number(key.slice(5, 7)) - 1]} ${key.slice(0, 4)}`;

export function reportRows(r: AdminReport): [string, number][] {
  return [
    ['طلاب جدد', r.new_students],
    ['دكاترة جدد', r.new_professors],
    ['إجمالي المستخدمين', r.total_users],
    ['نشطون هذا الشهر', r.active_users],
    ['حجوزات ساعات مكتبية', r.bookings],
    ['ألغاها الدكتور', r.cancelled_by_host],
    ['ألغاها الطالب', r.cancelled_by_student],
    ['تحضير بالـ QR', r.checkins],
    ['إعلانات القنوات', r.posts],
    ['نسخ سحابية محدّثة', r.backups],
    ['أعطال', r.errors],
  ];
}

/** نسبة الاحتفاظ التقريبية: النشطون من الإجمالي. */
export const activeRate = (r: AdminReport) => (r.total_users ? Math.round((r.active_users / r.total_users) * 100) : 0);

export function reportCsv(r: AdminReport): string {
  const esc = (v: string | number) => {
    const s = String(v ?? '');
    const safe = /^[=+\-@]/.test(s) ? `'${s}` : s;
    return /[",\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
  };
  const lines = [
    ['تقرير مذاكر', monthLabel(r.month)],
    [],
    ['المؤشر', 'العدد'],
    ...reportRows(r),
    ['نسبة النشطين %', activeRate(r)],
    [],
    ['الجامعة', 'مستخدمون جدد'],
    ...r.universities.map((u) => [u.university || 'غير محددة', u.users]),
    [],
    ['أسبوع يبدأ', 'تسجيلات'],
    ...r.weeks.map((w) => [w.week, w.signups]),
  ];
  return '﻿' + lines.map((l) => l.map(esc).join(',')).join('\n');
}
