import { describe, expect, it, jest } from '@jest/globals';
import type { Course, Session, Slot, Task } from '@/store/useStore';
import { widgetProps, widgetTimeline, type WidgetProps } from '../widgetData';

// الويدجت يتحول نصاً عند البناء؛ نلتقطه كما يرسله التطبيق للامتداد
jest.mock('expo-widgets', () => ({ createWidget: (name: string, layout: unknown) => ({ name, layout }) }));
// eslint-disable-next-line @typescript-eslint/no-require-imports
const widget = require('../../widgets/MudhakerNext').default as { name: string; layout: unknown };

// الإثنين 5 أكتوبر 2026 الساعة 9:30 صباحاً (توقيت الجهاز)
const at = (h: number, m = 0, day = 5) => new Date(2026, 9, day, h, m).getTime();
const courses: Course[] = [{ id: 'c1', name: 'هياكل البيانات', code: 'CS 2301', color: '#0EA5E9', credits: 3, instructor: 'د. سارة' }];
const slots: Slot[] = [
  { id: 's1', courseId: 'c1', day: 1, start: 600, end: 700, room: 'مبنى 3 · 204', type: 'lecture' },
  { id: 's2', courseId: 'c1', day: 1, start: 780, end: 840, room: '', type: 'lab' },
  { id: 's3', courseId: '', day: 2, start: 540, end: 600, room: 'مكتب 8', type: 'office' },
];
const tasks: Task[] = [
  { id: 't1', title: 'واجب 3', courseId: 'c1', type: 'assignment', due: '2026-10-06', priority: 2, notes: '', done: false, createdAt: 0 },
  { id: 't2', title: 'اختبار قصير', courseId: 'c1', type: 'quiz', due: '2026-10-08', priority: 3, notes: '', done: false, createdAt: 0 },
];
const sessions: Session[] = [{ id: 'x', courseId: 'c1', minutes: 40, at: at(8) }];
const state = { courses, slots, tasks, sessions, goal: 120, professor: false };

describe('widget data', () => {
  it('shows the next lecture, nearest task, exam and study progress', () => {
    const p = widgetProps(state, at(9, 30));
    expect(p.lesson).toMatchObject({ title: 'هياكل البيانات', kind: 'محاضرة', room: 'مبنى 3 · 204', live: false, dayLabel: '', at: at(10) });
    expect(p.laterToday).toBe(1);
    expect(p.task).toEqual({ title: 'واجب 3', due: 'غداً', overdue: false });
    expect(p.exam).toEqual({ title: 'اختبار قصير', days: 3 });
    expect(p.studied).toBe(40);
  });

  it('marks a running lecture as live, then moves on, then shows tomorrow', () => {
    expect(widgetProps(state, at(10, 15)).lesson).toMatchObject({ live: true, kind: 'محاضرة' });
    expect(widgetProps(state, at(12)).lesson).toMatchObject({ kind: 'معمل', live: false });
    expect(widgetProps(state, at(15)).lesson).toMatchObject({ kind: 'ساعات مكتبية', title: 'ساعات مكتبية', dayLabel: 'غداً' });
    expect(widgetProps({ ...state, slots: [] }, at(9)).lesson).toBeNull();
  });

  it('builds a timeline at every start/end within 24h, resetting study at midnight', () => {
    const tl = widgetTimeline(state, at(9, 30));
    const times = tl.map((e) => e.date.getTime());
    expect(times).toEqual([...times].sort((a, b) => a - b));
    for (const t of [at(9, 30), at(10), at(11, 40), at(13), at(14), at(0, 0, 6), at(9, 0, 6)]) expect(times).toContain(t);
    expect(times.every((t) => t >= at(9, 30) && t <= at(9, 30) + 86_400_000)).toBe(true);
    expect(tl.find((e) => e.date.getTime() === at(0, 0, 6))!.props.studied).toBe(0);
    // الحمولة نص JSON بسيط (تُرسل للامتداد)
    expect(JSON.parse(JSON.stringify(tl[0].props))).toEqual(tl[0].props);
  });
});

describe('widget layout runs inside the extension runtime', () => {
  // نفس الأسماء التي يعرّفها امتداد الويدجت عالمياً (عناصر SwiftUI، المعدّلات، و _jsx)
  const el = (type: string) => type;
  const mod = (name: string) => (...args: unknown[]) => ({ name, args });
  const globals: Record<string, unknown> = {
    _jsx: (type: unknown, props: Record<string, unknown>) => ({ type, props }),
    _jsxs: (type: unknown, props: Record<string, unknown>) => ({ type, props }),
    _Fragment: 'fragment',
    Text: el('Text'),
    VStack: el('VStack'),
    HStack: el('HStack'),
    Spacer: el('Spacer'),
  };
  for (const m of ['containerBackground', 'font', 'foregroundStyle', 'frame', 'lineLimit', 'padding', 'widgetURL']) globals[m] = mod(m);

  const render = (props: WidgetProps, widgetFamily: string, colorScheme: 'light' | 'dark' = 'light') => {
    expect(typeof widget.layout).toBe('string');
    const fn = new Function(...Object.keys(globals), `return (${widget.layout as string});`)(...Object.values(globals)) as (p: WidgetProps, e: object) => unknown;
    return JSON.stringify(fn(props, { widgetFamily, colorScheme, date: new Date(), configuration: undefined }));
  };

  const full = widgetProps(state, at(9, 30));
  const empty = widgetProps({ ...state, slots: [], tasks: [], sessions: [] }, at(9, 30));
  const families = ['systemSmall', 'systemMedium', 'systemLarge', 'systemExtraLarge', 'accessoryRectangular', 'accessoryInline'];

  it('uses only names the extension provides, for every size, with and without data', () => {
    expect(widget.name).toBe('MudhakerNext');
    for (const f of families) {
      for (const p of [full, empty, widgetProps(state, at(10, 15)), widgetProps(state, at(15))]) {
        expect(() => render(p, f)).not.toThrow();
        expect(() => render(p, f, 'dark')).not.toThrow();
      }
    }
  });

  it('renders the useful bits', () => {
    expect(render(full, 'systemMedium')).toContain('هياكل البيانات');
    expect(render(full, 'systemMedium')).toContain('واجب 3');
    expect(render(full, 'systemLarge')).toContain('اختبار قصير بعد 3 يوم');
    expect(render(full, 'accessoryInline')).toContain('محاضرتك: هياكل البيانات');
    expect(render(empty, 'systemSmall')).toContain('لا مواعيد قادمة');
    expect(render(widgetProps(state, at(10, 15)), 'systemSmall')).toContain('محاضرة الآن');
    expect(render(full, 'systemSmall')).toContain('mudhaker://schedule');
  });
});
