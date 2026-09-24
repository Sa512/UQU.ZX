/**
 * بطاقات المشاركة: تحوّل نتيجة داخل التطبيق إلى صورة ستوري (9:16) يشاركها الطالب.
 * كل مشاركة تحمل شعار التطبيق ورابطه، فتصير إعلاناً مجانياً بين الطلاب.
 * الدوال هنا نقية (بلا واجهة) لتسهل تجربتها.
 */
import type { AbsenceStatus } from './absence';
import { gpaRating, type GradeScale } from './gpa';
import type { GradeSummary } from './grades';
import { ABSENCES, DAYS, unit } from './plural';

export type CardTone = 'violet' | 'emerald' | 'rose' | 'amber' | 'midnight' | 'sky';

export type ShareCardData = {
  tone: CardTone;
  /** سطر صغير أعلى البطاقة. */
  eyebrow: string;
  /** الرقم أو الكلمة الكبيرة. */
  big: string;
  /** وحدة صغيرة بجانب الرقم الكبير (مثل «من 40»). */
  suffix?: string;
  title: string;
  sub?: string;
  /** أسطر إضافية (لبطاقة الملخص). */
  lines?: { label: string; value: string }[];
};

const fmt = (n: number) => String(Math.round(n * 100) / 100);

/** «كم أحتاج في النهائي؟»: أعلى تقدير ما زال ممكناً. */
export function needCard(courseName: string, s: GradeSummary): ShareCardData | null {
  if (s.graded === 0) return null;
  const secured = s.targets.filter((t) => t.status === 'secured');
  if (secured.length && secured[0].grade === 'A+') {
    return { tone: 'emerald', eyebrow: courseName, big: 'A+', title: 'ضامن الـ A+ قبل النهائي 😎', sub: `مجموعي ${fmt(s.earned)} من ${s.graded}` };
  }
  const goal = s.targets.find((t) => t.status === 'possible');
  if (!goal) {
    const best = secured[0];
    return best
      ? { tone: 'amber', eyebrow: courseName, big: best.grade, title: `${best.grade} مضمونة، والباقي على الله 🤲`, sub: `مجموعي ${fmt(s.earned)} من ${s.graded}` }
      : null;
  }
  const ratio = s.remaining ? goal.need / s.remaining : 1;
  return {
    tone: ratio > 0.85 ? 'rose' : ratio > 0.65 ? 'amber' : 'violet',
    eyebrow: `${courseName} · عشان ${goal.grade}`,
    big: fmt(goal.need),
    suffix: `من ${fmt(s.remaining)}`,
    title: 'أحتاجها في النهائي',
    sub: ratio > 0.85 ? 'ادعوا لي 🙏' : ratio > 0.65 ? 'تحتاج شد حيل 💪' : 'في المتناول ✨',
  };
}

/** «كم غياب باقي لي؟». */
export function absenceCard(courseName: string, st: AbsenceStatus): ShareCardData {
  const eyebrow = `${courseName} · حد الحرمان 25%`;
  if (st.level === 'barred') {
    return { tone: 'rose', eyebrow, big: '0', suffix: 'غياب', title: 'باقي لي… خلاص انحرمت 💀', sub: 'لا تسوونها زيي' };
  }
  const left = Math.max(0, st.remaining);
  return {
    tone: st.level === 'ok' ? 'emerald' : st.level === 'warn' ? 'amber' : 'rose',
    eyebrow,
    big: String(left),
    suffix: unit(left, ABSENCES),
    title: left === 0 ? 'ولا غياب زيادة! 😬' : 'باقي لي قبل الحرمان',
    sub: st.level === 'ok' ? 'ماشي تمام ✅' : st.level === 'warn' ? 'بدأت أقرب 👀' : 'على الحافة 😰',
  };
}

export function gpaCard(gpa: number, scale: GradeScale): ShareCardData {
  const r = gpaRating(gpa, scale);
  return {
    tone: gpa >= (scale === 5 ? 4.5 : 3.5) ? 'emerald' : 'violet',
    eyebrow: 'معدلي التراكمي',
    big: gpa.toFixed(2),
    suffix: `من ${scale}`,
    title: `تقدير ${r}`,
    sub: gpa >= (scale === 5 ? 4.75 : 3.75) ? 'مرتبة الشرف الأولى؟ 👀' : 'والقادم أحلى 📈',
  };
}

export function streakCard(days: number): ShareCardData {
  return {
    tone: days >= 7 ? 'amber' : 'violet',
    eyebrow: 'سلسلة المذاكرة',
    big: String(days),
    suffix: unit(days, DAYS),
    title: 'متتالية وأنا أذاكر 🔥',
    sub: days >= 7 ? 'مين يقدر يكسرها؟' : 'باقي لي على الأسبوع',
  };
}

