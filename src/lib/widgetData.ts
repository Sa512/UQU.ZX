/**
 * بيانات ويدجت الشاشة الرئيسية (آيفون وآيباد): المحاضرة الحالية أو القادمة، وأقرب تسليم، وتقدم مذاكرة اليوم.
 * نبني «جدولاً زمنياً» لليوم: تحديث عند بداية كل محاضرة ونهايتها وعند منتصف الليل،
 * فيتقدم الويدجت وحده دون فتح التطبيق. منطق خالص (يُختبر بلا جهاز).
 */
import type { Course, Session, Slot, Task } from '@/store/useStore';
import { diffDays, formatMinutes, fromDateKey, toDateKey } from './dates';
import { minutesOn, streak } from './stats';

export type WidgetLesson = {
  title: string;
  kind: string;
  /** «10:00 ص – 11:40 ص» */
  time: string;
  room: string;
  color: string;
  /** بداية الموعد (ms) — الويدجت يعرض «بعد 25 دقيقة» حياً منها. */
  at: number;
  /** جارية الآن. */
  live: boolean;
  /** ليست اليوم (أول موعد غداً أو بعده). */
  dayLabel: string;
};

export type WidgetProps = {
  professor: boolean;
  lesson: WidgetLesson | null;
  /** عدد ما تبقى من مواعيد اليوم بعد المعروض. */
  laterToday: number;
  task: { title: string; due: string; overdue: boolean } | null;
  exam: { title: string; days: number } | null;
  studied: number;
  goal: number;
  streak: number;
};

type State = { courses: Course[]; slots: Slot[]; tasks: Task[]; sessions: Session[]; goal: number; professor: boolean };

const KIND: Record<Slot['type'], string> = { lecture: 'محاضرة', lab: 'معمل', office: 'ساعات مكتبية' };
const DAYS = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];

const startOfDay = (ms: number) => {
  const d = new Date(ms);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
};

function lessonAt(s: State, now: number): { lesson: WidgetLesson | null; laterToday: number } {
  const d = new Date(now);
  const min = d.getHours() * 60 + d.getMinutes();
  const course = (id: string) => s.courses.find((c) => c.id === id);
  const toLesson = (x: Slot, dayOffset: number): WidgetLesson => {
    const c = course(x.courseId);
    return {
      title: c?.name ?? KIND[x.type],
      kind: KIND[x.type],
      time: `${formatMinutes(x.start)} – ${formatMinutes(x.end)}`,
      room: x.room,
      color: c?.color ?? '#4F46E5',
      at: startOfDay(now) + dayOffset * 86_400_000 + x.start * 60_000,
      live: dayOffset === 0 && x.start <= min && x.end > min,
      dayLabel: dayOffset === 0 ? '' : dayOffset === 1 ? 'غداً' : DAYS[(d.getDay() + dayOffset) % 7],
    };
  };
  const today = s.slots.filter((x) => x.day === d.getDay() && x.end > min).sort((a, b) => a.start - b.start);
  if (today.length) return { lesson: toLesson(today[0], 0), laterToday: today.length - 1 };
  for (let off = 1; off <= 7; off++) {
    const day = s.slots.filter((x) => x.day === (d.getDay() + off) % 7).sort((a, b) => a.start - b.start);
    if (day.length) return { lesson: toLesson(day[0], off), laterToday: 0 };
  }
  return { lesson: null, laterToday: 0 };
}

function dueLabel(days: number): string {
  if (days < 0) return 'متأخرة';
  if (days === 0) return 'اليوم';
  if (days === 1) return 'غداً';
  return `بعد ${days} أيام`;
}

export function widgetProps(s: State, now: number): WidgetProps {
  const today = new Date(now);
  const open = s.tasks.filter((t) => !t.done).sort((a, b) => a.due.localeCompare(b.due) || b.priority - a.priority);
  const t = open.find((x) => x.type !== 'exam' && x.type !== 'quiz') ?? open[0];
  const exam = open.find((x) => (x.type === 'exam' || x.type === 'quiz') && x.due >= toDateKey(today));
  const days = (key: string) => diffDays(today, fromDateKey(key));
  return {
    professor: s.professor,
    ...lessonAt(s, now),
    task: t ? { title: t.title, due: dueLabel(days(t.due)), overdue: days(t.due) < 0 } : null,
    exam: exam ? { title: exam.title, days: days(exam.due) } : null,
    studied: Math.round(minutesOn(s.sessions, today)),
    goal: s.goal,
    streak: streak(s.sessions, today),
  };
}

/** نقاط التحديث خلال 24 ساعة: الآن، وبداية كل موعد ونهايته، ومنتصف الليل. */
export function widgetTimeline(s: State, now: number): { date: Date; props: WidgetProps }[] {
  const base = startOfDay(now);
  const points = new Set<number>([now, base + 86_400_000]);
  for (const off of [0, 1]) {
    const day = (new Date(now).getDay() + off) % 7;
    for (const x of s.slots.filter((y) => y.day === day)) {
      for (const m of [x.start, x.end]) {
        const at = base + off * 86_400_000 + m * 60_000;
        if (at > now && at <= now + 86_400_000) points.add(at);
      }
    }
  }
  return [...points]
    .sort((a, b) => a - b)
    .slice(0, 30)
    .map((at) => ({ date: new Date(at), props: widgetProps(s, at) }));
}
