/** إغلاق الفصل: دمج معدل الفصل الحالي في السجل التراكمي. */
import { cumulativeGpa, termGpa, type GpaCourse, type GradeScale } from './gpa';

export function closeSemester(prevGpa: number, prevCredits: number, rows: GpaCourse[], scale: GradeScale) {
  const term = termGpa(rows, scale);
  const credits = prevCredits + term.credits;
  const gpa = credits ? cumulativeGpa(prevGpa, prevCredits, rows, scale) : 0;
  return { prevGpa: Math.round(gpa * 100) / 100, prevCredits: credits, termCredits: term.credits };
}
