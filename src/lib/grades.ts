/**
 * درجات المقرر: توزيع الـ 100 درجة على أعمال الفصل والاختبار النهائي.
 * يحسب ما حصّله الطالب، وما تبقّى، وما يحتاجه في المتبقي لكل تقدير.
 */
import { GRADES, gradeFromPercent, type Grade } from './gpa';

export type Assessment = { id: string; courseId: string; name: string; outOf: number; got: number | null };

/** الحد الأدنى من 100 لكل تقدير. */
export const GRADE_MIN: Record<Grade, number> = { 'A+': 95, A: 90, 'B+': 85, B: 80, 'C+': 75, C: 70, 'D+': 65, D: 60, F: 0 };

export type Target = { grade: Grade; need: number; status: 'secured' | 'possible' | 'impossible' };

export type GradeSummary = {
  earned: number; // مجموع ما حصلت عليه
  graded: number; // مجموع درجات ما صُحّح
  remaining: number; // درجات لم تُرصد بعد (من 100)
  planned: number; // مجموع التوزيع المدخل
  pct: number | null; // نسبتك فيما صُحّح
  projected: Grade | null; // التقدير المتوقع إن استمر أداؤك بنفس النسبة
  best: number; // أعلى مجموع ممكن
  targets: Target[];
};

export function summarize(items: Assessment[]): GradeSummary {
  let earned = 0;
  let graded = 0;
  let planned = 0;
  for (const a of items) {
    const outOf = Math.max(0, a.outOf);
    planned += outOf;
    if (a.got !== null && Number.isFinite(a.got)) {
      earned += Math.min(Math.max(a.got, 0), outOf);
      graded += outOf;
    }
  }
  // ما لم يُدخل في التوزيع يُعد متبقياً حتى يكتمل المجموع إلى 100
  const remaining = Math.max(0, 100 - graded);
  const pct = graded > 0 ? earned / graded : null;
  const round = (n: number) => Math.round(n * 100) / 100;
  const targets: Target[] = GRADES.filter((g) => g !== 'F').map((grade) => {
    const need = round(GRADE_MIN[grade] - earned);
    const status = need <= 0 ? 'secured' : need > remaining ? 'impossible' : 'possible';
    return { grade, need: Math.max(0, need), status };
  });
  return {
    earned: round(earned),
    graded,
    remaining: round(remaining),
    planned,
    pct,
    projected: pct === null ? null : gradeFromPercent(pct * 100),
    best: round(earned + remaining),
    targets,
  };
}
