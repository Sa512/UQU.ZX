import { describe, expect, it } from '@jest/globals';
import type { Course, Task } from '@/store/useStore';
import { inferType, matchCourse, mergeIcs, normalizeFeedUrl, parseIcs, parseIcsDate, MAX_EVENTS } from '../ical';

// عيّنة بشكل ملف تقويم Blackboard Learn (أسطر مطوية، ونهايات CRLF، وحروف مهرّبة)
const BB = [
  'BEGIN:VCALENDAR',
  'VERSION:2.0',
  'PRODID:-//Blackboard Inc.//Blackboard Learn//EN',
  'BEGIN:VEVENT',
  'UID:_1001_1@bb.uqu.edu.sa',
  'DTSTART:20261020T205900Z',
  'SUMMARY:الواجب الأول\\, تسليم',
  'LOCATION:CS2301-1041: هياكل البيانات',
  'DESCRIPTION:سلّم الحل بصيغة PDF\\nقبل الموعد',
  'END:VEVENT',
  'BEGIN:VEVENT',
  'UID:_1002_1@bb.uqu.edu.sa',
  'DTSTART;VALUE=DATE:20261101',
  'SUMMARY:Midterm Exam - MATH 1302 Calculus',
  '  II (Section 2)', // المسافة الأولى للطي (RFC 5545) والثانية من النص
  'END:VEVENT',
  'BEGIN:VEVENT',
  'UID:_1003_1@bb.uqu.edu.sa',
  'DTSTART:20250101T100000Z',
  'SUMMARY:حدث قديم',
  'END:VEVENT',
  'BEGIN:VTODO',
  'UID:todo-1',
  'DUE;TZID=Asia/Riyadh:20261025T235900',
  'SUMMARY:Quiz 3',
  'CATEGORIES:PHYS 1101',
  'END:VTODO',
  'BEGIN:VEVENT',
  'SUMMARY:بدون تاريخ',
  'END:VEVENT',
  'END:VCALENDAR',
].join('\r\n');

const courses = [
  { id: 'ds', name: 'هياكل البيانات', code: 'CS 2301', color: '#4F46E5', credits: 3, instructor: '' },
  { id: 'calc', name: 'التفاضل والتكامل 2', code: 'MATH 1302', color: '#059669', credits: 3, instructor: '' },
  { id: 'phys', name: 'الفيزياء العامة', code: 'PHYS 1101', color: '#B45309', credits: 3, instructor: '' },
] as Course[];

describe('parseIcs', () => {
  it('reads events and todos, unfolds lines and unescapes text', () => {
    const ev = parseIcs(BB);
    expect(ev).toHaveLength(4); // الحدث بلا تاريخ يُتجاهل
    expect(ev[0]).toMatchObject({ uid: '_1001_1@bb.uqu.edu.sa', summary: 'الواجب الأول, تسليم', allDay: false });
    expect(ev[0].description).toBe('سلّم الحل بصيغة PDF\nقبل الموعد');
    expect(ev[0].start.toISOString()).toBe('2026-10-20T20:59:00.000Z');
    expect(ev[1]).toMatchObject({ summary: 'Midterm Exam - MATH 1302 Calculus II (Section 2)', allDay: true });
    expect(ev[3]).toMatchObject({ uid: 'todo-1', summary: 'Quiz 3', categories: 'PHYS 1101' });
  });

  it('parses the three date forms', () => {
    expect(parseIcsDate('20261101')).toMatchObject({ allDay: true });
    expect(parseIcsDate('20261020T205900Z')!.date.toISOString()).toBe('2026-10-20T20:59:00.000Z');
    expect(parseIcsDate('20261025T235900')!.date.getHours()).toBe(23);
    expect(parseIcsDate('tomorrow')).toBeNull();
  });

  it('caps huge or hostile files', () => {
    const many = ['BEGIN:VCALENDAR', ...Array.from({ length: MAX_EVENTS + 50 }, (_, i) => `BEGIN:VEVENT\nUID:${i}\nDTSTART:20261020\nSUMMARY:x${i}\nEND:VEVENT`), 'END:VCALENDAR'].join('\n');
    expect(parseIcs(many)).toHaveLength(MAX_EVENTS);
    expect(() => parseIcs('x'.repeat(2_000_001))).toThrow('ics_too_large');
  });
});

describe('mapping to tasks', () => {
  it('infers the type in Arabic and English', () => {
    expect(inferType('Midterm Exam')).toBe('exam');
    expect(inferType('الاختبار النهائي')).toBe('exam');
    expect(inferType('اختبار قصير 2')).toBe('quiz');
    expect(inferType('Quiz 3')).toBe('quiz');
    expect(inferType('مشروع التخرج')).toBe('project');
    expect(inferType('الواجب الأول')).toBe('assignment');
  });

  it('matches courses by code with or without spaces, or by name', () => {
    const ev = parseIcs(BB);
    expect(matchCourse(ev[0], courses)).toBe('ds');
    expect(matchCourse(ev[1], courses)).toBe('calc');
    expect(matchCourse(ev[3], courses)).toBe('phys');
    expect(matchCourse({ ...ev[0], summary: 'x', location: '', description: '' }, courses)).toBeNull();
  });

  it('merges upcoming events once, updates moved dates, and never touches done or own tasks', () => {
    const now = new Date(2026, 9, 1);
    const own: Task = { id: 'mine', title: 'مهمتي', courseId: null, type: 'assignment', due: '2026-10-10', priority: 2, notes: '', done: false, createdAt: 0 };
    const first = mergeIcs([own], parseIcs(BB), courses, 'f1', now);
    expect(first).toMatchObject({ added: 3, updated: 0, skipped: 1 }); // القديم يُتخطى
    expect(first.tasks.find((t) => t.title === 'Quiz 3')).toMatchObject({ type: 'quiz', courseId: 'phys' });
    expect(first.tasks.find((t) => t.title.startsWith('Midterm'))).toMatchObject({ type: 'exam', priority: 3, due: '2026-11-01' });

    // إعادة الاستيراد لا تكرر، والتأجيل يُحدَّث
    const moved = BB.replace('DTSTART;VALUE=DATE:20261101', 'DTSTART;VALUE=DATE:20261108');
    const second = mergeIcs(first.tasks, parseIcs(moved), courses, 'f1', now);
    expect(second).toMatchObject({ added: 0, updated: 1 });
    expect(second.tasks.find((t) => t.title.startsWith('Midterm'))?.due).toBe('2026-11-08');
    expect(second.tasks.find((t) => t.id === 'mine')).toEqual(own);

    // ما أنجزه الطالب لا يُعدَّل
    const done = second.tasks.map((t) => (t.title === 'Quiz 3' ? { ...t, done: true } : t));
    const third = mergeIcs(done, parseIcs(BB.replace('20261025T235900', '20261030T235900')), courses, 'f1', now);
    expect(third.tasks.find((t) => t.title === 'Quiz 3')?.due).toBe('2026-10-25');
  });
});

describe('feed URLs', () => {
  it('accepts https and webcal only', () => {
    expect(normalizeFeedUrl('webcal://bb.uqu.edu.sa/webapps/calendar/calendarFeed/abc/learn.ics')).toBe('https://bb.uqu.edu.sa/webapps/calendar/calendarFeed/abc/learn.ics');
    expect(normalizeFeedUrl(' https://lms.ksu.edu.sa/cal.ics ')).toBe('https://lms.ksu.edu.sa/cal.ics');
    expect(normalizeFeedUrl('http://insecure.example.com/cal.ics')).toBeNull();
    expect(normalizeFeedUrl('javascript:alert(1)')).toBeNull();
    expect(normalizeFeedUrl('not a url')).toBeNull();
  });
});
