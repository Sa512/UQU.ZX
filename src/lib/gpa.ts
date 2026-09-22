/**
 * حاسبة المعدل وفق نظام الجامعات السعودية (من ٥ أو من ٤).
 * المرجع: لائحة الدراسة والاختبارات للمرحلة الجامعية.
 */
export type GradeScale = 4 | 5;

export const GRADES = ['A+', 'A', 'B+', 'B', 'C+', 'C', 'D+', 'D', 'F'] as const;
export type Grade = (typeof GRADES)[number];

export const GRADE_INFO: Record<Grade, { ar: string; range: string; p5: number; p4: number }> = {
  'A+': { ar: 'أ+', range: '95 – 100', p5: 5.0, p4: 4.0 },
  A: { ar: 'أ', range: '90 – 94', p5: 4.75, p4: 3.75 },
  'B+': { ar: 'ب+', range: '85 – 89', p5: 4.5, p4: 3.5 },
  B: { ar: 'ب', range: '80 – 84', p5: 4.0, p4: 3.0 },
  'C+': { ar: 'ج+', range: '75 – 79', p5: 3.5, p4: 2.5 },
  C: { ar: 'ج', range: '70 – 74', p5: 3.0, p4: 2.0 },
  'D+': { ar: 'د+', range: '65 – 69', p5: 2.5, p4: 1.5 },
  D: { ar: 'د', range: '60 – 64', p5: 2.0, p4: 1.0 },
  F: { ar: 'هـ', range: 'أقل من 60', p5: 1.0, p4: 0 },
};

export const gradePoints = (g: Grade, scale: GradeScale) =>
  scale === 5 ? GRADE_INFO[g].p5 : GRADE_INFO[g].p4;

export function gradeFromPercent(pct: number): Grade {
  if (pct >= 95) return 'A+';
  if (pct >= 90) return 'A';
  if (pct >= 85) return 'B+';
  if (pct >= 80) return 'B';
  if (pct >= 75) return 'C+';
  if (pct >= 70) return 'C';
  if (pct >= 65) return 'D+';
  if (pct >= 60) return 'D';
  return 'F';
}

export type GpaCourse = { credits: number; grade: Grade };

export function termGpa(courses: GpaCourse[], scale: GradeScale): { gpa: number; credits: number; points: number } {
  let credits = 0;
  let points = 0;
  for (const c of courses) {
    if (!(c.credits > 0)) continue;
    credits += c.credits;
    points += c.credits * gradePoints(c.grade, scale);
  }
  return { gpa: credits ? points / credits : 0, credits, points };
}

export function cumulativeGpa(
  prevGpa: number,
  prevCredits: number,
  courses: GpaCourse[],
  scale: GradeScale,
): number {
  const term = termGpa(courses, scale);
  const pc = prevCredits > 0 ? prevCredits : 0;
  const pg = Math.min(Math.max(prevGpa || 0, 0), scale);
  const total = pc + term.credits;
  if (!total) return 0;
  return (pg * pc + term.points) / total;
}

export function gpaRating(gpa: number, scale: GradeScale): string {
  const t = scale === 5 ? [4.5, 3.75, 2.75, 2] : [3.5, 2.75, 1.75, 1];
  if (gpa >= t[0]) return 'ممتاز';
  if (gpa >= t[1]) return 'جيد جداً';
  if (gpa >= t[2]) return 'جيد';
  if (gpa >= t[3]) return 'مقبول';
  return 'دون المقبول';
}

/** المعدل اللازم في الفصل القادم للوصول لمعدل تراكمي مستهدف. null إذا كان مستحيلاً. */
export function requiredTermGpa(
  prevGpa: number,
  prevCredits: number,
  target: number,
  nextCredits: number,
  scale: GradeScale,
): number | null {
  if (!(nextCredits > 0)) return null;
  const need = (target * (prevCredits + nextCredits) - prevGpa * prevCredits) / nextCredits;
  const min = scale === 5 ? 1 : 0;
  if (need > scale + 1e-9) return null;
  return Math.max(need, min);
}

export const round2 = (n: number) => Math.round(n * 100) / 100;
