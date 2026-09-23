/**
 * صياغة العدد مع المعدود وفق قواعد العربية:
 * ١ ← «مهمة واحدة»، ٢ ← «مهمتين»، ٣–١٠ ← «٣ مهام»، ١١+ ← «١٢ مهمة»، ٠ ← «٠ مهام».
 * نستخدم صيغة المثنى المنصوبة/المجرورة (ـين) لأنها الأشيع في سياقات الواجهة.
 */
export type Forms = { one: string; two: string; few: string; many: string };

export function ar(n: number, f: Forms): string {
  const abs = Math.abs(Math.round(n));
  if (abs === 1) return f.one;
  if (abs === 2) return f.two;
  if (abs >= 3 && abs <= 10) return `${n} ${f.few}`;
  if (abs === 0) return `0 ${f.few}`;
  return `${n} ${f.many}`;
}

export const DAYS: Forms = { one: 'يوم', two: 'يومين', few: 'أيام', many: 'يوماً' };
export const TASKS: Forms = { one: 'مهمة واحدة', two: 'مهمتين', few: 'مهام', many: 'مهمة' };
export const SLOTS: Forms = { one: 'حصة واحدة', two: 'حصتين', few: 'حصص', many: 'حصة' };
export const COURSES: Forms = { one: 'مقرر واحد', two: 'مقررين', few: 'مقررات', many: 'مقرراً' };
export const CARDS: Forms = { one: 'بطاقة واحدة', two: 'بطاقتين', few: 'بطاقات', many: 'بطاقة' };
export const DECKS: Forms = { one: 'مجموعة واحدة', two: 'مجموعتين', few: 'مجموعات', many: 'مجموعة' };
export const HOURS: Forms = { one: 'ساعة واحدة', two: 'ساعتين', few: 'ساعات', many: 'ساعة' };
export const MINUTES: Forms = { one: 'دقيقة واحدة', two: 'دقيقتين', few: 'دقائق', many: 'دقيقة' };
export const WEEKS: Forms = { one: 'أسبوع واحد', two: 'أسبوعين', few: 'أسابيع', many: 'أسبوعاً' };
export const STUDENTS: Forms = { one: 'طالب واحد', two: 'طالبين', few: 'طلاب', many: 'طالباً' };
export const LECTURES: Forms = { one: 'محاضرة واحدة', two: 'محاضرتين', few: 'محاضرات', many: 'محاضرة' };
export const MEETINGS: Forms = { one: 'لقاء واحد', two: 'لقاءين', few: 'لقاءات', many: 'لقاءً' };
export const ABSENCES: Forms = { one: 'غياب واحد', two: 'غيابين', few: 'غيابات', many: 'غياباً' };
