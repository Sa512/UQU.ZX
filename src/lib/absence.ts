/**
 * الغياب والحرمان: وفق لائحة الدراسة في الجامعات السعودية يُحرم الطالب من دخول
 * الاختبار النهائي إذا تجاوز غيابه ٢٥٪ من محاضرات المقرر.
 */
export const BAR_LIMIT = 0.25;

export type AbsenceLevel = 'ok' | 'warn' | 'danger' | 'barred';

export type AbsenceStatus = {
  total: number; // عدد محاضرات الفصل
  allowed: number; // أقصى غياب دون حرمان
  remaining: number; // كم غياباً بقي قبل الحرمان
  pct: number; // نسبة الغياب الحالية
  level: AbsenceLevel;
};

export function absenceStatus(absences: number, weeklyMeetings: number, weeks: number): AbsenceStatus {
  const total = Math.max(1, Math.round(weeklyMeetings) * Math.round(weeks));
  const allowed = Math.floor(total * BAR_LIMIT);
  const remaining = allowed - absences;
  const level: AbsenceLevel =
    remaining < 0 ? 'barred' : remaining <= 1 ? 'danger' : absences >= allowed / 2 ? 'warn' : 'ok';
  return { total, allowed, remaining, pct: absences / total, level };
}
