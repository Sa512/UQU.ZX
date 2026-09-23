/** سجل درجات الشعبة لعضو هيئة التدريس. */
import { latinDigits, parseTable } from './csv';
import { gradeFromPercent, type Grade } from './gpa';

export type GradeItem = { id: string; sectionId: string; name: string; outOf: number };
/** الدرجات: المفتاح `${itemId}:${studentId}`. */
export type Scores = Record<string, number>;

export const scoreKey = (itemId: string, studentId: string) => `${itemId}:${studentId}`;

export type StudentTotal = { studentId: string; total: number; outOf: number; pct: number | null; grade: Grade | null; missing: number };

export function studentTotals(studentIds: string[], items: GradeItem[], scores: Scores): StudentTotal[] {
  return studentIds.map((sid) => {
    let total = 0;
    let outOf = 0;
    let missing = 0;
    for (const it of items) {
      const v = scores[scoreKey(it.id, sid)];
      if (v === undefined) {
        missing++;
        continue;
      }
      total += Math.min(Math.max(v, 0), it.outOf);
      outOf += it.outOf;
    }
    const pct = outOf ? total / outOf : null;
    return { studentId: sid, total: Math.round(total * 100) / 100, outOf, pct, grade: pct === null ? null : gradeFromPercent(pct * 100), missing };
  });
}

export type ItemStats = { count: number; avg: number | null; max: number | null; min: number | null };

export function itemStats(item: GradeItem, studentIds: string[], scores: Scores): ItemStats {
  const vals = studentIds.map((s) => scores[scoreKey(item.id, s)]).filter((v): v is number => v !== undefined);
  if (!vals.length) return { count: 0, avg: null, max: null, min: null };
  const avg = vals.reduce((a, b) => a + b, 0) / vals.length;
  return { count: vals.length, avg: Math.round(avg * 100) / 100, max: Math.max(...vals), min: Math.min(...vals) };
}

/** توزيع التقديرات على الطلاب المكتملة درجاتهم جزئياً أو كلياً. */
export function distribution(totals: StudentTotal[]): Partial<Record<Grade, number>> {
  const d: Partial<Record<Grade, number>> = {};
  for (const t of totals) if (t.grade) d[t.grade] = (d[t.grade] ?? 0) + 1;
  return d;
}

/**
 * يطابق درجات ملصوقة (من Excel) مع طلاب الشعبة بالرقم الجامعي أو الاسم.
 * كل صف يحتوي معرّف الطالب ودرجة واحدة.
 */
export function matchScores(
  text: string,
  students: { id: string; name: string; uniId: string }[],
  outOf: number,
): { matched: Record<string, number>; unmatched: number; overMax: number } {
  const byId = new Map(students.filter((s) => s.uniId).map((s) => [s.uniId, s.id]));
  const byName = new Map(students.map((s) => [s.name.replace(/\s+/g, ' ').trim(), s.id]));
  const matched: Record<string, number> = {};
  let unmatched = 0;
  let overMax = 0;
  for (const row of parseTable(text)) {
    const cells = row.map((c) => latinDigits(c).trim());
    const idCell = cells.find((c) => byId.has(c));
    const nameCell = row.find((c) => byName.has(c.replace(/\s+/g, ' ').trim()));
    const sid = idCell ? byId.get(idCell) : nameCell ? byName.get(nameCell.replace(/\s+/g, ' ').trim()) : undefined;
    const scoreCell = cells.find((c) => c !== idCell && /^\d{1,3}([.,]\d+)?$/.test(c));
    if (!sid || scoreCell === undefined) {
      if (row.some((c) => c.trim())) unmatched++;
      continue;
    }
    const v = Number(scoreCell.replace(',', '.'));
    if (v > outOf) {
      overMax++;
      continue;
    }
    matched[sid] = v;
  }
  return { matched, unmatched, overMax };
}
