import { describe, expect, it } from '@jest/globals';
import type { Course, Section, Slot, Task } from '@/store/useStore';
import { createDemoApi } from '../cloud/demoApi';
import type { SectionChannel } from '../cloud/types';
import { parseQr } from '../officeHours';
import { buildChannel, joinLink, needsSync, sanitizeChannel, syncChannel, unreadPosts, SYNC_EVERY_MS } from '../sectionChannel';

const course: Course = { id: 'c1', name: 'هياكل البيانات', code: 'CS 2301', color: '#4F46E5', credits: 3, instructor: '' };
const section: Section = { id: 's1', courseId: 'c1', code: '1041' };
const slot = (p: Partial<Slot>): Slot => ({ id: Math.random().toString(), courseId: 'c1', day: 0, start: 480, end: 580, room: 'مبنى 5', type: 'lecture', ...p });
const task = (p: Partial<Task>): Task => ({ id: Math.random().toString(), title: 'x', courseId: 'c1', type: 'exam', due: '2026-10-20', priority: 2, notes: '', done: false, createdAt: 0, ...p });

const channel = (p: Partial<SectionChannel> = {}): SectionChannel => ({
  id: 'ch1', code: 'ABC234', course_name: 'هياكل البيانات', course_code: 'CS 2301', section_code: '1041', instructor: 'د. سارة', color: '#4F46E5',
  updated_at: '2026-10-01T10:00:00Z',
  slots: [{ weekday: 0, start_min: 480, end_min: 580, type: 'lecture', location: 'مبنى 5' }, { weekday: 2, start_min: 780, end_min: 900, type: 'lab', location: 'معمل 2' }],
  exams: [{ title: 'الاختبار الفصلي الأول', date: '2026-10-20', type: 'exam' }],
  posts: [{ id: 'p1', body: 'أهلاً بكم', created_at: '2026-10-01T09:00:00Z' }],
  ...p,
});

describe('buildChannel (professor)', () => {
  it('publishes the section slots and upcoming assessments only', () => {
    const slots = [slot({ sectionId: 's1' }), slot({ sectionId: 's2', day: 1 }), slot({ type: 'office', courseId: '' }), slot({ courseId: 'other' })];
    const tasks = [task({ title: 'فصلي', due: '2026-10-20' }), task({ title: 'قديم', due: '2026-09-01' }), task({ title: 'قراءة', type: 'reading' }), task({ title: 'غيره', courseId: 'x' })];
    const ch = buildChannel({ course, section, slots, tasks, instructor: 'د. سارة', today: new Date(2026, 9, 1) });
    expect(ch.slots).toEqual([{ weekday: 0, start_min: 480, end_min: 580, type: 'lecture', location: 'مبنى 5' }]);
    expect(ch.exams.map((e) => e.title)).toEqual(['فصلي']);
    expect(ch).toMatchObject({ course_name: 'هياكل البيانات', section_code: '1041', instructor: 'د. سارة' });
  });

  it('falls back to course-wide slots when none are tied to the section', () => {
    const ch = buildChannel({ course, section, slots: [slot({}), slot({ sectionId: 's9' })], tasks: [], instructor: '', today: new Date() });
    expect(ch.slots).toHaveLength(1);
    expect(ch.instructor).toBe('عضو هيئة التدريس');
  });
});

describe('sanitizeChannel (untrusted server data)', () => {
  it('drops malformed fields instead of trusting them', () => {
    const c = sanitizeChannel({
      ...channel(),
      code: 'abc234',
      color: 'red;',
      slots: [{ weekday: 9, start_min: 0, end_min: 10 }, { weekday: 1, start_min: 600, end_min: 500 }, { weekday: 1, start_min: 600, end_min: 660, type: 'x', location: 5 }],
      exams: [{ title: 'ok', date: 'tomorrow' }, { title: 'فصلي', date: '2026-10-20', type: 'hack' }],
      posts: [{ id: 'p', body: '', created_at: 'x' }, 'junk'],
    })!;
    expect(c.code).toBe('ABC234');
    expect(c.color).toBe('#4F46E5');
    expect(c.slots).toEqual([{ weekday: 1, start_min: 600, end_min: 660, type: 'lecture', location: '' }]);
    expect(c.exams).toEqual([{ title: 'فصلي', date: '2026-10-20', type: 'exam' }]);
    expect(c.posts).toEqual([]);
  });
  it('rejects garbage', () => {
    expect(sanitizeChannel(null)).toBeNull();
    expect(sanitizeChannel({ code: 'ABC234', course_name: 'x' })).toBeNull();
    expect(sanitizeChannel({ code: '<script>', course_name: 'مادة' })).toBeNull();
  });
});

describe('syncChannel (student)', () => {
  const empty = { courses: [] as Course[], slots: [] as Slot[], tasks: [] as Task[] };

  it('joins: adds the course, lectures and exams, and treats old posts as read', () => {
    const r = syncChannel(empty, channel(), 1000);
    expect(r.joined).toBe(true);
    expect(r.courses).toHaveLength(1);
    expect(r.courses[0]).toMatchObject({ name: 'هياكل البيانات', instructor: 'د. سارة', credits: 2 });
    expect(r.slots.map((s) => [s.day, s.type, s.channelCode])).toEqual([[0, 'lecture', 'ABC234'], [2, 'lab', 'ABC234']]);
    expect(r.tasks).toHaveLength(1);
    expect(r.tasks[0]).toMatchObject({ title: 'الاختبار الفصلي الأول', type: 'exam', priority: 3, courseId: r.courseId });
    expect(unreadPosts(r.courses[0])).toEqual([]);
    expect(r.added).toEqual({ slots: 2, exams: 1 });
  });

  it('links to an existing course with the same code instead of duplicating', () => {
    const mine = { ...course, id: 'mine', color: '#059669', code: 'cs 2301' };
    const r = syncChannel({ ...empty, courses: [mine] }, channel(), 1000);
    expect(r.courses).toHaveLength(1);
    expect(r.courseId).toBe('mine');
    expect(r.courses[0].color).toBe('#059669'); // لون الطالب يبقى
  });

  it('updates: replaces channel lectures only, moves postponed exams, keeps done ones, flags new posts', () => {
    const first = syncChannel(empty, channel(), 1000);
    const own = slot({ courseId: first.courseId, day: 4, room: 'مذاكرة جماعية' });
    const data = { courses: first.courses, slots: [...first.slots, own], tasks: first.tasks.map((t) => ({ ...t, done: false })) };
    const next = channel({
      slots: [{ weekday: 1, start_min: 600, end_min: 700, type: 'lecture', location: 'قاعة 9' }],
      exams: [{ title: 'الاختبار الفصلي الأول', date: '2026-10-27', type: 'exam' }, { title: 'مشروع', date: '2026-11-10', type: 'project' }],
      posts: [{ id: 'p2', body: 'تأجيل الفصلي', created_at: '2026-10-05T09:00:00Z' }, ...channel().posts],
    });
    const r = syncChannel(data, next, 2000);
    expect(r.joined).toBe(false);
    expect(r.slots.filter((x) => x.channelCode)).toHaveLength(1);
    expect(r.slots).toContainEqual(own);
    expect(r.tasks.find((t) => t.title === 'الاختبار الفصلي الأول')?.due).toBe('2026-10-27');
    expect(r.changedExams).toBe(1);
    expect(r.added.exams).toBe(1);
    expect(unreadPosts(r.courses[0]).map((p) => p.body)).toEqual(['تأجيل الفصلي']);

    // الدكتور ألغى المشروع: يُحذف إن لم يُنجز، ويبقى إن أُنجز
    const done = { ...r, tasks: r.tasks.map((t) => (t.title === 'مشروع' ? { ...t, done: true } : t)) };
    const cancelled = channel({ exams: [{ title: 'الاختبار الفصلي الأول', date: '2026-10-27', type: 'exam' }] });
    expect(syncChannel(r, cancelled, 3000).tasks.some((t) => t.title === 'مشروع')).toBe(false);
    expect(syncChannel(done, cancelled, 3000).tasks.some((t) => t.title === 'مشروع')).toBe(true);
  });

  it('throttles automatic refresh', () => {
    const c = syncChannel(empty, channel(), 1000).courses[0];
    expect(needsSync(c, 1000 + SYNC_EVERY_MS - 1)).toBe(false);
    expect(needsSync(c, 1000 + SYNC_EVERY_MS)).toBe(true);
    expect(needsSync(course, 1e12)).toBe(false);
  });
});

describe('join codes', () => {
  it('parses join links and QR payloads', () => {
    expect(parseQr(joinLink('ABC234'))).toMatchObject({ kind: 'join', code: 'ABC234' });
    expect(parseQr('mudhaker://join?c=abc234')).toMatchObject({ kind: 'join', code: 'ABC234' });
  });

  it('demo cloud: publish, read, post limits and latest-20 window', async () => {
    let t = Date.UTC(2026, 9, 1);
    const api = createDemoApi(() => t);
    const input = { course_name: 'هياكل البيانات', course_code: 'CS 2301', section_code: '1041', instructor: 'د. سارة', color: '#4F46E5', slots: channel().slots, exams: channel().exams };
    const { id, code } = await api.publishSection(input);
    expect((await api.getSection(code.toLowerCase()))?.course_name).toBe('هياكل البيانات');
    await expect(api.getSection('ZZZZZZ')).resolves.toBeNull();
    for (let i = 0; i < 20; i++) {
      t += 1000;
      await api.postToSection(id, `إعلان ${i}`);
    }
    await expect(api.postToSection(id, 'زيادة')).rejects.toMatchObject({ code: 'too_many_posts' });
    await expect(api.postToSection(id, '   ')).rejects.toBeTruthy();
    t += 86_400_000;
    await api.postToSection(id, 'اليوم التالي');
    const ch = (await api.getSection(code))!;
    expect(ch.posts).toHaveLength(20);
    expect(ch.posts[0].body).toBe('اليوم التالي');
    await api.deletePost(ch.posts[0].id);
    expect((await api.getSection(code))!.posts[0].body).toBe('إعلان 19');
    const again = await api.publishSection({ ...input, id, exams: [] });
    expect(again.code).toBe(code);
    expect((await api.getSection(code))!.exams).toEqual([]);
  }, 20_000); // الوضع التجريبي يؤخر كل طلب ربع ثانية ليحاكي الشبكة
});
