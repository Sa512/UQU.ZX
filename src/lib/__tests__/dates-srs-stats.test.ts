import { describe, expect, it } from '@jest/globals';
import { addDays, diffDays, formatDuration, formatMinutes, fromDateKey, greeting, relativeDue, toDateKey } from '../dates';
import { absenceStatus } from '../absence';
import { ar, COURSES, DAYS, MINUTES, TASKS } from '../plural';
import { mastery, review } from '../srs';
import { lastWeek, streak } from '../stats';

describe('dates', () => {
  it('round-trips local date keys', () => {
    const d = new Date(2026, 0, 5);
    expect(toDateKey(d)).toBe('2026-01-05');
    expect(fromDateKey('2026-01-05').getTime()).toBe(d.getTime());
  });

  it('formats times in 12h Arabic', () => {
    expect(formatMinutes(8 * 60 + 5)).toBe('8:05 ص');
    expect(formatMinutes(12 * 60)).toBe('12:00 م');
    expect(formatMinutes(0)).toBe('12:00 ص');
    expect(formatMinutes(13 * 60 + 30)).toBe('1:30 م');
  });

  it('formats durations', () => {
    expect(formatDuration(45)).toBe('45 د');
    expect(formatDuration(120)).toBe('2 س');
    expect(formatDuration(95)).toBe('1 س 35 د');
  });

  it('describes due dates relative to now', () => {
    const now = new Date(2026, 8, 22, 15);
    expect(relativeDue('2026-09-22', now).label).toBe('اليوم');
    expect(relativeDue('2026-09-23', now).label).toBe('غداً');
    expect(relativeDue('2026-09-21', now).tone).toBe('danger');
    expect(diffDays(now, addDays(now, 3))).toBe(3);
  });
});

describe('spaced repetition', () => {
  const now = 1_000_000;
  it('promotes correct answers and schedules further out', () => {
    const r = review({ box: 1, due: 0 }, true, now);
    expect(r.box).toBe(2);
    expect(r.due).toBe(now + 2 * 86_400_000);
  });
  it('resets wrong answers to box 1', () => {
    expect(review({ box: 4, due: 0 }, false, now).box).toBe(1);
  });
  it('caps at box 5', () => {
    expect(review({ box: 5, due: 0 }, true, now).box).toBe(5);
  });
  it('computes mastery', () => {
    expect(mastery([])).toBe(0);
    expect(mastery([{ box: 1, due: 0 }, { box: 5, due: 0 }])).toBe(0.5);
  });
});

describe('stats', () => {
  const now = new Date(2026, 8, 22, 20);
  const at = (daysAgo: number) => addDays(now, -daysAgo).getTime();
  it('counts a streak ending today or yesterday', () => {
    const s = [0, 1, 2, 4].map((d, i) => ({ id: String(i), courseId: null, minutes: 30, at: at(d) }));
    expect(streak(s, now)).toBe(3);
    expect(streak(s.slice(1), now)).toBe(2);
    expect(streak([], now)).toBe(0);
  });
  it('builds a 7-day window ending today', () => {
    const w = lastWeek([{ id: '1', courseId: null, minutes: 40, at: at(0) }], now);
    expect(w).toHaveLength(7);
    expect(w[6].minutes).toBe(40);
    expect(w[0].minutes).toBe(0);
  });
});

describe('greeting', () => {
  it('matches the time of day', () => {
    expect(greeting(new Date(2026, 0, 1, 9))).toBe('صباح الخير');
    expect(greeting(new Date(2026, 0, 1, 12, 25))).toBe('نهارك سعيد');
    expect(greeting(new Date(2026, 0, 1, 19))).toBe('مساء الخير');
  });
});

describe('absenceStatus', () => {
  it('allows up to 25% of the semester lectures', () => {
    const s = absenceStatus(0, 3, 15); // 45 محاضرة
    expect(s).toMatchObject({ total: 45, allowed: 11, remaining: 11, level: 'ok' });
  });
  it('escalates warn → danger → barred', () => {
    expect(absenceStatus(6, 3, 15).level).toBe('warn');
    expect(absenceStatus(10, 3, 15).level).toBe('danger');
    expect(absenceStatus(11, 3, 15).level).toBe('danger');
    expect(absenceStatus(12, 3, 15).level).toBe('barred');
  });
});

describe('arabic plurals', () => {
  it('follows number agreement rules', () => {
    expect(ar(0, TASKS)).toBe('0 مهام');
    expect(ar(1, TASKS)).toBe('مهمة واحدة');
    expect(ar(2, DAYS)).toBe('يومين');
    expect(ar(7, DAYS)).toBe('7 أيام');
    expect(ar(15, MINUTES)).toBe('15 دقيقة');
    expect(ar(30, MINUTES)).toBe('30 دقيقة');
    expect(ar(5, MINUTES)).toBe('5 دقائق');
    expect(ar(12, COURSES)).toBe('12 مقرراً');
  });
  it('reads due dates naturally', () => {
    const now = new Date(2026, 8, 22, 15);
    expect(relativeDue('2026-09-24', now).label).toBe('بعد يومين');
    expect(relativeDue('2026-09-20', now).label).toBe('متأخر يومين');
    expect(relativeDue('2026-09-21', now).label).toBe('متأخر يوم');
  });
});
