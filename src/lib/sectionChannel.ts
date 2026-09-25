/**
 * «قناة الشعبة»: الدكتور ينشر جدول الشعبة واختباراتها وإعلاناته، والطالب ينضم بالرمز.
 * دوال نقية: بناء ما يُنشر، والتحقق مما يصل من الخادم، ودمجه في بيانات الطالب.
 */
import type { Course, Section, Slot, Task, TaskType } from '@/store/useStore';
import type { ChannelExam, ChannelInput, ChannelPost, ChannelSlot, SectionChannel } from './cloud/types';
import { toDateKey } from './dates';
import { uid } from './id';

export const joinLink = (code: string) => `mudhaker://join?c=${code}`;

const EXAM_TYPES: TaskType[] = ['exam', 'quiz', 'assignment', 'project'];
const HEX = /^#[0-9A-Fa-f]{6}$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const str = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const int = (v: unknown) => (typeof v === 'number' && Number.isInteger(v) ? v : NaN);

/** ما ينشره الدكتور: محاضرات الشعبة (أو المقرر إن لم تُحدَّد شعبة) واختباراتها القادمة. */
export function buildChannel(p: { course: Course; section: Section; slots: Slot[]; tasks: Task[]; instructor: string; today: Date }): ChannelInput {
  const own = p.slots.filter((s) => s.type !== 'office' && s.courseId === p.course.id);
  const bySection = own.filter((s) => s.sectionId === p.section.id);
  const slots: ChannelSlot[] = (bySection.length ? bySection : own.filter((s) => !s.sectionId)).slice(0, 20).map((s) => ({
    weekday: s.day,
    start_min: s.start,
    end_min: s.end,
    type: s.type === 'lab' ? 'lab' : 'lecture',
    location: s.room.slice(0, 120),
  }));
  const today = toDateKey(p.today);
  const exams: ChannelExam[] = p.tasks
    .filter((t) => t.courseId === p.course.id && EXAM_TYPES.includes(t.type) && t.due >= today)
    .sort((a, b) => a.due.localeCompare(b.due))
    .slice(0, 30)
    .map((t) => ({ title: t.title.slice(0, 120), date: t.due, type: t.type as ChannelExam['type'] }));
  return {
    course_name: p.course.name,
    course_code: p.course.code,
    section_code: p.section.code,
    instructor: (p.instructor || p.course.instructor || 'عضو هيئة التدريس').slice(0, 80),
    color: HEX.test(p.course.color) ? p.course.color : '#4F46E5',
    slots,
    exams,
  };
}

/** يتحقق مما يصل من الخادم قبل أن يلمس بيانات الطالب (أي حقل مخالف يُسقَط). */
export function sanitizeChannel(raw: unknown): SectionChannel | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const course_name = str(r.course_name, 120);
  const code = str(r.code, 6).toUpperCase();
  if (course_name.length < 2 || !/^[A-Z0-9]{6}$/.test(code)) return null;
  const slots: ChannelSlot[] = (Array.isArray(r.slots) ? r.slots : [])
    .slice(0, 20)
    .map((s: Record<string, unknown>) => ({ weekday: int(s?.weekday), start_min: int(s?.start_min), end_min: int(s?.end_min), type: s?.type === 'lab' ? ('lab' as const) : ('lecture' as const), location: str(s?.location, 120) }))
    .filter((s) => s.weekday >= 0 && s.weekday <= 6 && s.start_min >= 0 && s.end_min > s.start_min && s.end_min <= 1440);
  const exams: ChannelExam[] = (Array.isArray(r.exams) ? r.exams : [])
    .slice(0, 30)
    .map((e: Record<string, unknown>) => ({ title: str(e?.title, 120), date: str(e?.date, 10), type: (EXAM_TYPES.includes(e?.type as TaskType) ? e?.type : 'exam') as ChannelExam['type'] }))
    .filter((e) => e.title.length >= 2 && DATE.test(e.date));
  const posts: ChannelPost[] = (Array.isArray(r.posts) ? r.posts : [])
    .slice(0, 20)
    .map((x: Record<string, unknown>) => ({ id: str(x?.id, 64), body: str(x?.body, 500), created_at: str(x?.created_at, 40) }))
    .filter((x) => x.id && x.body && !Number.isNaN(Date.parse(x.created_at)));
  const color = str(r.color, 7);
  return {
    id: str(r.id, 64),
    code,
    course_name,
    course_code: str(r.course_code, 20),
    section_code: str(r.section_code, 20),
    instructor: str(r.instructor, 80) || 'عضو هيئة التدريس',
    color: HEX.test(color) ? color : '#4F46E5',
    updated_at: str(r.updated_at, 40),
    slots,
    exams,
    posts,
  };
}

type Data = { courses: Course[]; slots: Slot[]; tasks: Task[] };
export type SyncResult = Data & { courseId: string; joined: boolean; added: { slots: number; exams: number }; changedExams: number };

const examKey = (code: string, e: { title: string }) => `${code}|${e.title}`;

/**
 * يدمج القناة في بيانات الطالب. يُستدعى عند الانضمام وعند كل تحديث:
 * - المادة: تُربط بمادة موجودة بنفس الرمز أو تُنشأ (ويبقى لونها وساعاتها كما عدّلها الطالب).
 * - المحاضرات: تُستبدل محاضرات القناة فقط، ولا تُمس مواعيد الطالب الأخرى.
 * - الاختبارات: تُحدَّث بتاريخها الجديد إن تأجلت، وتُحذف إن ألغاها الدكتور (ما لم يُنجزها الطالب).
 */
export function syncChannel(d: Data, ch: SectionChannel, now: number): SyncResult {
  let course = d.courses.find((c) => c.channel?.code === ch.code);
  const joined = !course;
  course ??= ch.course_code ? d.courses.find((c) => !c.channel && c.code.trim().toUpperCase() === ch.course_code.toUpperCase()) : undefined;
  const courseId = course?.id ?? uid();
  const prev = course?.channel;
  const channel: NonNullable<Course['channel']> = {
    code: ch.code,
    section: ch.section_code,
    updatedAt: ch.updated_at,
    syncedAt: now,
    posts: ch.posts,
    // عند الانضمام تُعدّ الإعلانات السابقة مقروءة، فلا يصل «إعلان جديد» عن أشياء قديمة
    seenAt: prev?.seenAt ?? (ch.posts[0]?.created_at ?? new Date(now).toISOString()),
  };
  const courses = course
    ? d.courses.map((c) => (c.id === courseId ? { ...c, name: ch.course_name, code: ch.course_code || c.code, instructor: ch.instructor, channel } : c))
    : [...d.courses, { id: courseId, name: ch.course_name, code: ch.course_code, color: ch.color, credits: Math.max(1, Math.min(6, ch.slots.length || 3)), instructor: ch.instructor, channel }];

  const slots = [
    ...d.slots.filter((s) => s.channelCode !== ch.code),
    ...ch.slots.map((s) => ({ id: uid(), courseId, day: s.weekday, start: s.start_min, end: s.end_min, room: s.location, type: s.type, channelCode: ch.code }) as Slot),
  ];

  const keys = new Set(ch.exams.map((e) => examKey(ch.code, e)));
  let changedExams = 0;
  let addedExams = 0;
  const tasks: Task[] = [];
  for (const t of d.tasks) {
    if (!t.channelKey?.startsWith(`${ch.code}|`)) {
      tasks.push(t);
      continue;
    }
    if (!keys.has(t.channelKey)) {
      if (t.done) tasks.push(t); // أُنجز قبل الإلغاء: يبقى في السجل
      else changedExams++;
      continue;
    }
    const e = ch.exams.find((x) => examKey(ch.code, x) === t.channelKey)!;
    if (e.date !== t.due || e.type !== t.type) changedExams++;
    tasks.push({ ...t, due: e.date, type: e.type, courseId });
  }
  for (const e of ch.exams) {
    const k = examKey(ch.code, e);
    if (tasks.some((t) => t.channelKey === k)) continue;
    tasks.push({ id: uid(), title: e.title, courseId, type: e.type, due: e.date, priority: e.type === 'exam' ? 3 : 2, notes: `من ${ch.instructor}`, done: false, createdAt: now, channelKey: k });
    addedExams++;
  }
  return { courses, slots, tasks, courseId, joined, added: { slots: ch.slots.length, exams: addedExams }, changedExams: joined ? 0 : changedExams };
}

/** إعلانات لم يرها الطالب بعد. */
export function unreadPosts(course: Course): ChannelPost[] {
  const ch = course.channel;
  if (!ch?.posts?.length) return [];
  return ch.posts.filter((p) => p.created_at > ch.seenAt);
}

/** هل حان وقت تحديث القناة تلقائياً؟ (مرة كل 20 دقيقة كحد أقصى) */
export const SYNC_EVERY_MS = 20 * 60_000;
export const needsSync = (c: Course, now: number) => !!c.channel && now - (c.channel.syncedAt ?? 0) >= SYNC_EVERY_MS;
