/**
 * تخطيط التذكيرات (دالة نقية قابلة للاختبار):
 * - المحاضرات: تذكير أسبوعي متكرر قبل بدايتها بعدد دقائق يحدده المستخدم.
 * - المهام: مساء اليوم السابق (٨ م) وصباح يوم التسليم (٨ ص)، والاختبارات أيضاً قبلها بثلاثة أيام.
 * iOS يسمح بـ ٦٤ تذكيراً مجدولاً كحد أقصى، لذا نقتصر على الأقرب.
 */
import type { Course, Slot, Task } from '@/store/useStore';
import { addDays, formatMinutes, fromDateKey } from './dates';
import { SLOT_TYPES, TASK_TYPES } from './labels';
import { ar, MINUTES } from './plural';

export const MAX_SCHEDULED = 60;
export const EVENING_HOUR = 20;
export const MORNING_HOUR = 8;

export type ReminderTrigger =
  | { kind: 'weekly'; weekday: number; hour: number; minute: number } // weekday: 1 = الأحد … 7 = السبت
  | { kind: 'date'; date: number };

export type Reminder = { id: string; title: string; body: string; trigger: ReminderTrigger };

type Input = {
  courses: Course[];
  slots: Slot[];
  tasks: Task[];
  lectureLeadMin: number;
  now: number;
};

export function planReminders({ courses, slots, tasks, lectureLeadMin, now }: Input): Reminder[] {
  const byId = new Map(courses.map((c) => [c.id, c]));
  const out: Reminder[] = [];

  for (const s of slots) {
    const course = byId.get(s.courseId);
    if (!course) continue;
    let at = s.start - lectureLeadMin;
    let day = s.day;
    if (at < 0) {
      at += 24 * 60;
      day = (day + 6) % 7;
    }
    out.push({
      id: `slot-${s.id}`,
      title: `${course.name} بعد ${ar(lectureLeadMin, MINUTES)}`,
      body: [`${SLOT_TYPES[s.type].label} الساعة ${formatMinutes(s.start)}`, s.room].filter(Boolean).join(' · '),
      trigger: { kind: 'weekly', weekday: day + 1, hour: Math.floor(at / 60), minute: at % 60 },
    });
  }

  const dated: Reminder[] = [];
  for (const t of tasks) {
    if (t.done) continue;
    const due = fromDateKey(t.due);
    const course = t.courseId ? byId.get(t.courseId) : undefined;
    const body = [TASK_TYPES[t.type].label, course?.name].filter(Boolean).join(' · ');
    const at = (d: Date, hour: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), hour).getTime();
    const candidates: [string, number, string][] = [
      ['eve', at(addDays(due, -1), EVENING_HOUR), `غداً: ${t.title}`],
      ['day', at(due, MORNING_HOUR), `اليوم: ${t.title}`],
    ];
    if (t.type === 'exam') candidates.unshift(['exam3', at(addDays(due, -3), EVENING_HOUR), `بعد 3 أيام: ${t.title} — ابدأ المراجعة`]);
    for (const [key, date, title] of candidates) {
      if (date > now) dated.push({ id: `task-${t.id}-${key}`, title, body, trigger: { kind: 'date', date } });
    }
  }
  dated.sort((a, b) => (a.trigger as { date: number }).date - (b.trigger as { date: number }).date);

  return [...out, ...dated].slice(0, MAX_SCHEDULED);
}
