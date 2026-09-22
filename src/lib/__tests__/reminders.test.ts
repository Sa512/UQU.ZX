import { describe, expect, it } from '@jest/globals';
import type { Course, Slot, Task } from '@/store/useStore';
import { MAX_SCHEDULED, planReminders } from '../reminders';

const course: Course = { id: 'c1', name: 'هياكل البيانات', code: 'CS 2301', color: '#4F46E5', credits: 3, instructor: '' };
const slot = (p: Partial<Slot>): Slot => ({ id: 's1', courseId: 'c1', day: 0, start: 8 * 60, end: 9 * 60 + 30, room: 'قاعة 204', type: 'lecture', ...p });
const task = (p: Partial<Task>): Task => ({ id: 't1', title: 'واجب', courseId: 'c1', type: 'assignment', due: '2026-09-25', priority: 2, notes: '', done: false, createdAt: 0, ...p });
const now = new Date(2026, 8, 22, 12).getTime(); // الثلاثاء 22 سبتمبر 12 ظهراً

describe('planReminders', () => {
  it('schedules a weekly reminder before each lecture (1 = Sunday)', () => {
    const [r] = planReminders({ courses: [course], slots: [slot({})], tasks: [], lectureLeadMin: 15, now });
    expect(r.trigger).toEqual({ kind: 'weekly', weekday: 1, hour: 7, minute: 45 });
    expect(r.title).toContain('هياكل البيانات');
    expect(r.body).toContain('قاعة 204');
  });

  it('moves the reminder to the previous day when it crosses midnight', () => {
    const [r] = planReminders({ courses: [course], slots: [slot({ day: 0, start: 10 })], tasks: [], lectureLeadMin: 30, now });
    expect(r.trigger).toEqual({ kind: 'weekly', weekday: 7, hour: 23, minute: 40 });
  });

  it('skips slots whose course was deleted', () => {
    expect(planReminders({ courses: [], slots: [slot({})], tasks: [], lectureLeadMin: 15, now })).toHaveLength(0);
  });

  it('reminds the evening before and the morning of a due date', () => {
    const r = planReminders({ courses: [course], slots: [], tasks: [task({})], lectureLeadMin: 15, now });
    expect(r.map((x) => x.trigger)).toEqual([
      { kind: 'date', date: new Date(2026, 8, 24, 20).getTime() },
      { kind: 'date', date: new Date(2026, 8, 25, 8).getTime() },
    ]);
    expect(r[0].title).toBe('غداً: واجب');
  });

  it('adds a 3-day heads-up for exams', () => {
    const r = planReminders({ courses: [course], slots: [], tasks: [task({ type: 'exam', due: '2026-10-01' })], lectureLeadMin: 15, now });
    expect(r).toHaveLength(3);
    expect(r[0].trigger).toEqual({ kind: 'date', date: new Date(2026, 8, 28, 20).getTime() });
  });

  it('ignores done tasks and reminders already in the past', () => {
    expect(planReminders({ courses: [course], slots: [], tasks: [task({ done: true })], lectureLeadMin: 15, now })).toHaveLength(0);
    // موعد اليوم: فات تذكير الأمس والصباح
    expect(planReminders({ courses: [course], slots: [], tasks: [task({ due: '2026-09-22' })], lectureLeadMin: 15, now })).toHaveLength(0);
  });

  it('caps the total under the iOS limit, keeping the nearest', () => {
    const tasks = Array.from({ length: 50 }, (_, i) => task({ id: `t${i}`, due: `2026-10-${String((i % 28) + 1).padStart(2, '0')}` }));
    const r = planReminders({ courses: [course], slots: [], tasks, lectureLeadMin: 15, now });
    expect(r).toHaveLength(MAX_SCHEDULED);
    const dates = r.map((x) => (x.trigger as { date: number }).date);
    expect([...dates].sort((a, b) => a - b)).toEqual(dates);
  });
});
