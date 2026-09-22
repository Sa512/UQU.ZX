import type { Session } from '@/store/useStore';
import { addDays, diffDays, startOfDay, toDateKey } from './dates';

export function minutesOn(sessions: Session[], day: Date): number {
  const k = toDateKey(day);
  return sessions.reduce((a, s) => (toDateKey(new Date(s.at)) === k ? a + s.minutes : a), 0);
}

/** آخر ٧ أيام (الأقدم أولاً). */
export function lastWeek(sessions: Session[], now = new Date()): { date: Date; minutes: number }[] {
  return Array.from({ length: 7 }, (_, i) => {
    const date = addDays(startOfDay(now), i - 6);
    return { date, minutes: minutesOn(sessions, date) };
  });
}

/** عدد الأيام المتتالية التي ذاكر فيها المستخدم حتى اليوم (أو أمس إن لم يذاكر اليوم بعد). */
export function streak(sessions: Session[], now = new Date()): number {
  const days = new Set(sessions.map((s) => toDateKey(new Date(s.at))));
  let d = startOfDay(now);
  if (!days.has(toDateKey(d))) d = addDays(d, -1);
  let n = 0;
  while (days.has(toDateKey(d))) {
    n++;
    d = addDays(d, -1);
  }
  return n;
}

export function minutesByCourse(sessions: Session[], sinceDays: number, now = new Date()): Map<string | null, number> {
  const m = new Map<string | null, number>();
  for (const s of sessions) {
    if (diffDays(new Date(s.at), now) >= sinceDays) continue;
    m.set(s.courseId, (m.get(s.courseId) ?? 0) + s.minutes);
  }
  return m;
}
