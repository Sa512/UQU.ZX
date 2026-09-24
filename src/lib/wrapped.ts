/**
 * «ملخص فصلك»: أرقام الفصل في شرائح ستوري قابلة للمشاركة (على طريقة Spotify Wrapped).
 * دالة نقية تحسب من الجلسات والمهام منذ بداية الفصل.
 */
import type { Course, Session, Task } from '@/store/useStore';
import { addDays, DAY_NAMES, fromDateKey, shortName, startOfDay, toDateKey } from './dates';
import { ar, DAYS, HOURS, SESSIONS_F, TASKS, unit } from './plural';
import type { ShareCardData } from './shareCards';

export type Persona = { id: 'streak' | 'night' | 'morning' | 'organized' | 'smart'; emoji: string; title: string; desc: string };

export type Wrapped = {
  totalMinutes: number;
  sessions: number;
  activeDays: number;
  longestStreak: number;
  topCourse: { name: string; color: string; minutes: number } | null;
  bestWeekday: string | null;
  tasksDone: number;
  onTimeRate: number | null;
  persona: Persona;
};

/** أقصى مدة نعدّها فصلاً إن لم يُحدَّد تاريخ بدايته (نحو ٢٠ أسبوعاً). */
export const DEFAULT_WINDOW_DAYS = 140;

const PERSONAS: Record<Persona['id'], Omit<Persona, 'id'>> = {
  streak: { emoji: '🔥', title: 'المثابر', desc: 'ما تفوّت يوم. الاستمرار سلاحك.' },
  night: { emoji: '🦉', title: 'بومة الليل', desc: 'أفكارك تصحى لما ينام الكل.' },
  morning: { emoji: '🌅', title: 'طائر الصباح', desc: 'تخلّص مذاكرتك قبل ما يبدأ يومك.' },
  organized: { emoji: '✅', title: 'المنظّم', desc: 'مهامك تنتهي قبل موعدها. احترام.' },
  smart: { emoji: '⚡', title: 'المذاكر الذكي', desc: 'تذاكر وقت ما تحتاج، وبتركيز.' },
};

function longestRun(keys: Set<string>, from: Date, to: Date): number {
  let best = 0;
  let run = 0;
  for (let d = startOfDay(from); d <= to; d = addDays(d, 1)) {
    if (keys.has(toDateKey(d))) best = Math.max(best, ++run);
    else run = 0;
  }
  return best;
}

export function computeWrapped(p: { sessions: Session[]; tasks: Task[]; courses: Course[]; since: number; now: number }): Wrapped {
  const sessions = p.sessions.filter((s) => s.at >= p.since && s.at <= p.now);
  const totalMinutes = sessions.reduce((a, s) => a + s.minutes, 0);
  const keys = new Set(sessions.map((s) => toDateKey(new Date(s.at))));

  const byCourse = new Map<string, number>();
  const byDay = new Array(7).fill(0) as number[];
  let night = 0;
  let morning = 0;
  for (const s of sessions) {
    if (s.courseId) byCourse.set(s.courseId, (byCourse.get(s.courseId) ?? 0) + s.minutes);
    const d = new Date(s.at);
    byDay[d.getDay()] += s.minutes;
    const h = d.getHours();
    if (h >= 21 || h < 4) night++;
    else if (h >= 4 && h < 10) morning++;
  }
  const top = [...byCourse.entries()].sort((a, b) => b[1] - a[1])[0];
  const course = top && p.courses.find((c) => c.id === top[0]);
  const bestDay = byDay.some((m) => m > 0) ? byDay.indexOf(Math.max(...byDay)) : -1;

  const done = p.tasks.filter((t) => t.done && (t.doneAt ?? 0) >= p.since && (t.doneAt ?? 0) <= p.now);
  const withDue = done.filter((t) => t.due);
  const onTime = withDue.filter((t) => (t.doneAt ?? 0) < addDays(fromDateKey(t.due), 1).getTime()).length;
  const onTimeRate = withDue.length ? onTime / withDue.length : null;
  const longestStreak = longestRun(keys, new Date(p.since), new Date(p.now));

  const n = sessions.length;
  const id: Persona['id'] =
    longestStreak >= 7 ? 'streak'
    : n >= 3 && night / n >= 0.4 ? 'night'
    : n >= 3 && morning / n >= 0.4 ? 'morning'
    : done.length >= 5 && (onTimeRate ?? 0) >= 0.8 ? 'organized'
    : 'smart';

  return {
    totalMinutes,
    sessions: n,
    activeDays: keys.size,
    longestStreak,
    topCourse: course && top ? { name: course.name, color: course.color, minutes: top[1] } : null,
    bestWeekday: bestDay >= 0 ? DAY_NAMES[bestDay] : null,
    tasksDone: done.length,
    onTimeRate,
    persona: { id, ...PERSONAS[id] },
  };
}

const hours = (m: number) => {
  const h = m / 60;
  return h >= 10 ? String(Math.round(h)) : String(Math.round(h * 10) / 10);
};

/** شرائح الملخص بالترتيب. تُحذف الشريحة التي لا بيانات لها. */
export function wrappedSlides(w: Wrapped, name: string): ShareCardData[] {
  const first = shortName(name);
  const slides: ShareCardData[] = [
    { tone: 'violet', eyebrow: 'ملخص فصلك', big: '🎓', title: first ? `${first}، هذا فصلك بالأرقام` : 'هذا فصلك بالأرقام', sub: 'اضغط للتالي ←' },
    {
      tone: 'sky',
      eyebrow: 'ذاكرت هذا الفصل',
      big: hours(w.totalMinutes),
      suffix: unit(Math.round(w.totalMinutes / 60), HOURS),
      title: `في ${ar(w.sessions, SESSIONS_F)}`,
      sub: `على مدى ${ar(w.activeDays, DAYS)}`,
    },
  ];
  if (w.topCourse) {
    slides.push({ tone: 'emerald', eyebrow: 'مادتك المفضلة', big: hours(w.topCourse.minutes), suffix: 'ساعة', title: w.topCourse.name, sub: 'أكثر مادة أخذت من وقتك' });
  }
  if (w.longestStreak >= 2) {
    slides.push({ tone: 'amber', eyebrow: 'أطول سلسلة', big: String(w.longestStreak), suffix: unit(w.longestStreak, DAYS), title: 'متتالية بدون انقطاع 🔥' });
  }
  if (w.bestWeekday) {
    slides.push({ tone: 'midnight', eyebrow: 'يومك الذهبي', big: w.bestWeekday, title: 'أكثر يوم تذاكر فيه', sub: 'خلّه موعدك الثابت' });
  }
  if (w.tasksDone > 0) {
    slides.push({
      tone: 'rose',
      eyebrow: 'أنجزت',
      big: String(w.tasksDone),
      suffix: unit(w.tasksDone, TASKS),
      // النسبة تُعرض فقط إن كانت مشرّفة: البطاقة للمشاركة لا للّوم
      title: w.onTimeRate !== null && w.onTimeRate >= 0.5 ? `${Math.round(w.onTimeRate * 100)}% منها في وقتها` : 'واجبات واختبارات ومشاريع',
    });
  }
  slides.push({ tone: 'violet', eyebrow: 'شخصيتك في المذاكرة', big: w.persona.emoji, title: w.persona.title, sub: w.persona.desc });
  slides.push({
    tone: 'midnight',
    eyebrow: 'ملخص فصلي',
    big: w.persona.emoji,
    title: w.persona.title,
    lines: [
      { label: 'ساعات المذاكرة', value: hours(w.totalMinutes) },
      ...(w.topCourse ? [{ label: 'مادتي المفضلة', value: w.topCourse.name }] : []),
      { label: 'أطول سلسلة', value: ar(w.longestStreak, DAYS) },
      { label: 'مهام منجزة', value: String(w.tasksDone) },
    ],
  });
  return slides;
}

/** يظهر تنبيه «ملخص فصلك» في الرئيسية آخر أسبوعين من الفصل، إذا كان عند المستخدم ما يستحق المشاركة. */
export function wrappedReady(p: { sessions: Session[]; startedAt: number | null; semesterWeeks: number; now: number }): boolean {
  if (p.sessions.length < 5) return false;
  const start = p.startedAt ?? Math.min(...p.sessions.map((s) => s.at));
  return p.now - start >= Math.max(1, p.semesterWeeks - 2) * 7 * 86_400_000;
}
