import { describe, expect, it } from '@jest/globals';
import type { Course, Session, Task } from '@/store/useStore';
import { absenceStatus } from '../absence';
import { summarize, type Assessment } from '../grades';
import { ABSENCES, DAYS, unit } from '../plural';
import { absenceCard, gpaCard, needCard, streakCard } from '../shareCards';
import { computeWrapped, wrappedReady, wrappedSlides } from '../wrapped';

const a = (name: string, outOf: number, got: number | null): Assessment => ({ id: name, courseId: 'c', name, outOf, got });
const DAY = 86_400_000;

describe('unit', () => {
  it('picks the counted-noun form for a displayed number', () => {
    expect([0, 1, 2, 3, 10, 11].map((n) => unit(n, ABSENCES))).toEqual(['غيابات', 'غياب', 'غيابين', 'غيابات', 'غيابات', 'غياباً']);
    expect(unit(1, DAYS)).toBe('يوم');
  });
});

describe('needCard', () => {
  it('shows the best still-possible grade, like the TikTok example', () => {
    // 17 + 18 + 9.5 + 10 = 54.5 من 60، والنهائي 40
    const s = summarize([a('m1', 20, 17), a('m2', 20, 18), a('hw', 10, 9.5), a('part', 10, 10), a('final', 40, null)]);
    const c = needCard('هياكل البيانات', s)!;
    expect(c.eyebrow).toContain('عشان A');
    expect(c.big).toBe('35.5');
    expect(c.tone).toBe('rose');
    expect(c.suffix).toBe('من 40');
  });

  it('returns null before any grade is entered', () => {
    expect(needCard('x', summarize([a('final', 40, null)]))).toBeNull();
  });

  it('celebrates when A+ is already secured', () => {
    const c = needCard('x', summarize([a('all', 100, 97)]))!;
    expect(c.big).toBe('A+');
    expect(c.tone).toBe('emerald');
  });

  it('rounds fractional needs to two decimals', () => {
    const c = needCard('x', summarize([a('m', 60, 54.333), a('final', 40, null)]))!;
    expect(c.big).toBe('35.67');
  });
});

describe('absenceCard', () => {
  it('shows remaining absences with the right tone', () => {
    const ok = absenceCard('فيزياء', absenceStatus(0, 2, 15));
    expect(ok).toMatchObject({ big: '7', suffix: 'غيابات', tone: 'emerald' });
    const edge = absenceCard('فيزياء', absenceStatus(6, 2, 15));
    expect(edge).toMatchObject({ big: '1', suffix: 'غياب', tone: 'rose' });
    const barred = absenceCard('فيزياء', absenceStatus(9, 2, 15));
    expect(barred.big).toBe('0');
    expect(barred.title).toContain('انحرمت');
  });
});

describe('gpa and streak cards', () => {
  it('formats GPA with two decimals and the scale', () => {
    expect(gpaCard(4.5, 5)).toMatchObject({ big: '4.50', suffix: 'من 5', tone: 'emerald' });
    expect(gpaCard(3.1, 4)).toMatchObject({ big: '3.10', suffix: 'من 4', tone: 'violet' });
  });
  it('uses the day noun for streaks', () => {
    expect(streakCard(2).suffix).toBe('يومين');
    expect(streakCard(9).tone).toBe('amber');
  });
});

describe('computeWrapped', () => {
  const now = new Date(2026, 11, 20, 12).getTime();
  const since = now - 60 * DAY;
  const courses = [
    { id: 'c1', name: 'هياكل البيانات', color: '#4F46E5' },
    { id: 'c2', name: 'التفاضل', color: '#059669' },
  ] as Course[];
  const at = (daysAgo: number, hour: number) => {
    const d = new Date(now - daysAgo * DAY);
    d.setHours(hour, 0, 0, 0);
    return d.getTime();
  };
  const s = (id: string, courseId: string | null, minutes: number, t: number): Session => ({ id, courseId, minutes, at: t });

  it('aggregates totals, top course, streak and persona', () => {
    const sessions = [
      // سلسلة ٣ أيام ليلاً
      s('1', 'c1', 50, at(3, 22)),
      s('2', 'c1', 50, at(2, 23)),
      s('3', 'c2', 25, at(1, 22)),
      s('4', 'c1', 25, at(10, 15)),
      // قبل بداية الفصل: لا تُحسب
      s('old', 'c2', 500, since - DAY),
    ];
    const w = computeWrapped({ sessions, tasks: [], courses, since, now });
    expect(w).toMatchObject({ totalMinutes: 150, sessions: 4, activeDays: 4, longestStreak: 3 });
    expect(w.topCourse).toEqual({ name: 'هياكل البيانات', color: '#4F46E5', minutes: 125 });
    expect(w.persona.id).toBe('night');
  });

  it('prefers the streak persona for a 7-day run and measures on-time tasks', () => {
    const sessions = Array.from({ length: 7 }, (_, k) => s(String(k), 'c2', 30, at(k, 9)));
    const task = (id: string, due: string, doneAt: number) => ({ id, title: id, courseId: null, type: 'assignment', due, priority: 2, notes: '', done: true, createdAt: since, doneAt }) as Task;
    const tasks = [task('a', '2026-12-10', new Date(2026, 11, 10, 23).getTime()), task('b', '2026-12-01', new Date(2026, 11, 3).getTime())];
    const w = computeWrapped({ sessions, tasks, courses, since, now });
    expect(w.persona.id).toBe('streak');
    expect(w.tasksDone).toBe(2);
    expect(w.onTimeRate).toBe(0.5);
  });

  it('builds slides and skips the ones without data', () => {
    const w = computeWrapped({ sessions: [s('1', null, 90, at(1, 9))], tasks: [], courses, since, now });
    const slides = wrappedSlides(w, 'د. سارة الحربي');
    expect(slides[0].title).toContain('د. سارة');
    expect(slides.some((x) => x.eyebrow === 'مادتك المفضلة')).toBe(false);
    expect(slides.some((x) => x.eyebrow === 'أطول سلسلة')).toBe(false);
    expect(slides[1]).toMatchObject({ big: '1.5' });
    expect(slides.at(-1)?.lines?.length).toBeGreaterThan(0);
  });
});

describe('wrappedReady', () => {
  const now = Date.now();
  const sessions = Array.from({ length: 5 }, (_, k) => ({ id: String(k), courseId: null, minutes: 25, at: now - k * DAY }));
  it('shows only in the last two weeks of the semester', () => {
    expect(wrappedReady({ sessions, startedAt: now - 13 * 7 * DAY, semesterWeeks: 15, now })).toBe(true);
    expect(wrappedReady({ sessions, startedAt: now - 10 * 7 * DAY, semesterWeeks: 15, now })).toBe(false);
  });
  it('needs a few sessions first', () => {
    expect(wrappedReady({ sessions: sessions.slice(0, 2), startedAt: now - 20 * 7 * DAY, semesterWeeks: 15, now })).toBe(false);
  });
});
