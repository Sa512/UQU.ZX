import { describe, expect, it } from '@jest/globals';
import { distribution, itemStats, matchScores, scoreKey, studentTotals, type GradeItem } from '../gradebook';
import { makeGroups, shuffle } from '../groups';
import { parseSchedule } from '../scheduleImport';
import { exportSchedule, SHARE_INTRO } from '../scheduleExport';
import { closeSemester } from '../semester';
import { planReviews } from '../studyPlan';

const seeded = (seed = 1) => () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;

describe('gradebook', () => {
  const items: GradeItem[] = [
    { id: 'm1', sectionId: 's', name: 'فصلي 1', outOf: 20 },
    { id: 'm2', sectionId: 's', name: 'فصلي 2', outOf: 20 },
  ];
  const scores = { [scoreKey('m1', 'a')]: 18, [scoreKey('m2', 'a')]: 19, [scoreKey('m1', 'b')]: 10 };
  it('totals per student, ignoring missing items', () => {
    const [a, b, c] = studentTotals(['a', 'b', 'c'], items, scores);
    expect(a).toMatchObject({ total: 37, outOf: 40, grade: 'A', missing: 0 });
    expect(a.pct).toBeCloseTo(0.925);
    expect(b).toMatchObject({ total: 10, outOf: 20, grade: 'F', missing: 1 });
    expect(c).toMatchObject({ total: 0, outOf: 0, pct: null, grade: null, missing: 2 });
    expect(distribution([a, b, c])).toEqual({ A: 1, F: 1 });
  });
  it('item stats', () => {
    expect(itemStats(items[0], ['a', 'b', 'c'], scores)).toEqual({ count: 2, avg: 14, max: 18, min: 10 });
    expect(itemStats(items[1], ['b'], scores)).toEqual({ count: 0, avg: null, max: null, min: null });
  });
});

describe('groups', () => {
  const people = Array.from({ length: 10 }, (_, i) => i);
  it('shuffles without losing items', () => {
    expect(shuffle(people, seeded()).sort((a, b) => a - b)).toEqual(people);
  });
  it('balances sizes', () => {
    const bySize = makeGroups(people, 3, 'size', seeded());
    expect(bySize.map((g) => g.length).sort()).toEqual([3, 3, 4]);
    const byCount = makeGroups(people, 4, 'count', seeded());
    expect(byCount).toHaveLength(4);
    expect(Math.max(...byCount.map((g) => g.length)) - Math.min(...byCount.map((g) => g.length))).toBeLessThanOrEqual(1);
    expect(byCount.flat()).toHaveLength(10);
    expect(makeGroups([], 3, 'size')).toEqual([]);
  });
});

describe('study plan', () => {
  const now = new Date(2026, 8, 20, 10);
  it('spaces sessions before the exam', () => {
    const p = planReviews('الفيزياء', '2026-10-01', now); // بعد 11 يوماً
    expect(p.map((x) => x.due)).toEqual(['2026-09-21', '2026-09-24', '2026-09-26', '2026-09-28', '2026-09-29', '2026-09-30']);
    expect(p[0].title).toContain('(1/6)');
  });
  it('fits into the time left', () => {
    expect(planReviews('X', '2026-09-23', now).map((x) => x.due)).toEqual(['2026-09-20', '2026-09-21', '2026-09-22']);
    expect(planReviews('X', '2026-09-20', now)).toEqual([]);
  });
});

describe('schedule export', () => {
  it('round-trips through the importer', () => {
    const courses = [{ id: 'c', name: 'هياكل البيانات', code: 'CS 2301', color: '#000', credits: 3, instructor: '' }];
    const sections = [{ id: 'sec', courseId: 'c', code: '1041' }];
    const slots = [
      { id: '1', courseId: 'c', sectionId: 'sec', day: 2, start: 480, end: 580, room: 'مبنى 5', type: 'lecture' as const },
      { id: '2', courseId: '', day: 1, start: 780, end: 840, room: 'مكتب 3', type: 'office' as const },
      { id: '3', courseId: 'c', day: 4, start: 360, end: 450, room: '', type: 'lab' as const },
      { id: '4', courseId: 'c', day: 4, start: 690, end: 750, room: '', type: 'lecture' as const },
    ];
    const back = parseSchedule(`${SHARE_INTRO}\n\n${exportSchedule(slots, courses, sections)}`);
    expect(back.skipped).toBe(0);
    expect(back.slots).toEqual([
      { course: '', courseName: '', section: '', day: 1, start: 780, end: 840, room: 'مكتب 3', type: 'office' },
      { course: 'CS 2301', courseName: 'هياكل البيانات', section: '1041', day: 2, start: 480, end: 580, room: 'مبنى 5', type: 'lecture' },
      { course: 'CS 2301', courseName: 'هياكل البيانات', section: '', day: 4, start: 360, end: 450, room: '', type: 'lab' },
      { course: 'CS 2301', courseName: 'هياكل البيانات', section: '', day: 4, start: 690, end: 750, room: '', type: 'lecture' },
    ]);
  });
});

describe('closeSemester', () => {
  it('merges the term into the cumulative record', () => {
    expect(closeSemester(4, 60, [{ credits: 15, grade: 'A+' }], 5)).toEqual({ prevGpa: 4.2, prevCredits: 75, termCredits: 15 });
    expect(closeSemester(0, 0, [], 5)).toEqual({ prevGpa: 0, prevCredits: 0, termCredits: 0 });
  });
});

describe('matchScores', () => {
  const students = [
    { id: 'a', name: 'سارة محمد', uniId: '443001122' },
    { id: 'b', name: 'نورة علي', uniId: '443001133' },
    { id: 'c', name: 'ريم', uniId: '' },
  ];
  it('matches by university id or name and skips bad rows', () => {
    const r = matchScores('الرقم\tالدرجة\n443001122\t18.5\n٤٤٣٠٠١١٣٣\t١٧\nريم\t25\nمجهول\t10', students, 20);
    expect(r.matched).toEqual({ a: 18.5, b: 17 });
    expect(r.overMax).toBe(1); // 25 > 20
    expect(r.unmatched).toBe(2); // صف العناوين + «مجهول»
  });
});
