/**
 * خطة مراجعة متباعدة قبل الاختبار: جلسات تتقارب كلما اقترب الموعد
 * (قبل ١٠، ٧، ٥، ٣، ٢، ١ أيام) — بحسب الوقت المتاح.
 */
import { addDays, diffDays, fromDateKey, toDateKey } from './dates';

export const OFFSETS = [10, 7, 5, 3, 2, 1];

export type PlannedSession = { due: string; title: string; step: number; total: number };

export function planReviews(examTitle: string, examDate: string, now = new Date()): PlannedSession[] {
  const exam = fromDateKey(examDate);
  const available = diffDays(now, exam);
  const days = OFFSETS.filter((o) => o <= available - 0 && o >= 1 && diffDays(now, addDays(exam, -o)) >= 0);
  const total = days.length;
  const labels = ['تلخيص الفصول', 'حل أسئلة سابقة', 'مراجعة النقاط الصعبة', 'اختبار ذاتي', 'بطاقات المراجعة', 'مراجعة خفيفة ونوم مبكر'];
  return days.map((o, i) => ({
    due: toDateKey(addDays(exam, -o)),
    step: i + 1,
    total,
    title: `مراجعة ${examTitle} (${i + 1}/${total}): ${labels[Math.min(i + (labels.length - total), labels.length - 1)]}`,
  }));
}
