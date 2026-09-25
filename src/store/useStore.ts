import { useSyncExternalStore } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { courseColors } from '@/theme/colors';
import { addDays, toDateKey } from '@/lib/dates';
import type { BackupData } from '@/lib/backup';
import type { Grade, GradeScale } from '@/lib/gpa';
import type { AttendanceRecord } from '@/lib/attendance';
import type { Assessment } from '@/lib/grades';
import { scoreKey, type GradeItem, type Scores } from '@/lib/gradebook';
import { closeSemester } from '@/lib/semester';
import type { RosterRow } from '@/lib/roster';
import type { ImportedSlot } from '@/lib/scheduleImport';
import { uid } from '@/lib/id';
import type { PaymentMethod, PlanId } from '@/lib/payments';
import { review } from '@/lib/srs';
import type { ChannelPost, SectionChannel } from '@/lib/cloud/types';
import { syncChannel, type SyncResult } from '@/lib/sectionChannel';

export type Role = 'student' | 'professor';
export type ThemePref = 'system' | 'light' | 'dark';

export type Settings = {
  name: string;
  role: Role;
  university: string;
  major: string;
  gradeScale: GradeScale;
  theme: ThemePref;
  dailyGoalMin: number;
  focusMin: number;
  breakMin: number;
  haptics: boolean;
  onboarded: boolean;
  remindersEnabled: boolean;
  /** كم دقيقة قبل المحاضرة يصل التذكير. */
  lectureLeadMin: number;
  remindersPromptDismissed: boolean;
  /** عدد أسابيع الفصل الدراسي (لحساب نسبة الغياب). */
  semesterWeeks: number;
  /** آخر مرة طُلب فيها تقييم التطبيق. */
  reviewAskedAt: number | null;
  /** آخر إصدار رأى المستخدم «ما الجديد» فيه. */
  lastSeenVersion: string;
  /** الرقم الجامعي للطالب (للحجز والتحضير). */
  uniId: string;
  /** بداية الفصل الحالي (لـ«ملخص فصلك»). يُضبط عند بدء فصل جديد. */
  semesterStartedAt: number | null;
};

export type Course = {
  id: string;
  name: string;
  code: string;
  color: string;
  credits: number;
  instructor: string;
  /** عدد مرات الغياب المسجلة (للطالب). */
  absences?: number;
  /** للطالب: المادة مرتبطة بقناة شعبة نشرها الدكتور. */
  channel?: { code: string; section: string; updatedAt: string; syncedAt: number; posts: ChannelPost[]; seenAt: string };
};

export type SlotType = 'lecture' | 'lab' | 'office';
export type Slot = {
  id: string;
  /** '' للساعات المكتبية غير المرتبطة بمقرر. */
  courseId: string;
  sectionId?: string;
  day: number; // 0 = الأحد
  start: number; // دقائق منذ منتصف الليل
  end: number;
  room: string;
  type: SlotType;
  /** موعد وصل من قناة الشعبة (يُستبدل عند التحديث). */
  channelCode?: string;
};

export type TaskType = 'assignment' | 'exam' | 'quiz' | 'project' | 'reading' | 'grading';
export type Task = {
  id: string;
  title: string;
  courseId: string | null;
  type: TaskType;
  due: string; // yyyy-mm-dd
  priority: 1 | 2 | 3;
  notes: string;
  done: boolean;
  createdAt: number;
  doneAt?: number;
  /** اختبار وصل من قناة الشعبة («الرمز|العنوان»). */
  channelKey?: string;
};

/** شعبة لعضو هيئة التدريس. */
export type Section = { id: string; courseId: string; code: string; /** قناة الشعبة المنشورة للطلاب. */ channel?: { id: string; code: string } };
export type Student = { id: string; sectionId: string; name: string; uniId: string; email: string; phone: string };

/** صفحة الساعات المكتبية المنشورة للدكتور. */
export type OfficePage = { id: string; code: string; title: string; slotMinutes: number; open: boolean };
/** حجز الطالب محفوظ محلياً للعرض والتذكير دون اتصال. */
export type MyBooking = { id: string; code: string; title: string; host: string; startsAt: string; location: string; status: 'booked' | 'cancelled' };

export type Session = { id: string; courseId: string | null; minutes: number; at: number };

export type Card = { id: string; front: string; back: string; box: number; due: number };
export type Deck = { id: string; title: string; courseId: string | null; cards: Card[]; createdAt: number };

export type GpaRow = { id: string; name: string; credits: number; grade: Grade };
export type GpaState = { prevGpa: number; prevCredits: number; rows: GpaRow[] };

export type Subscription = {
  plan: 'free' | PlanId;
  until: number | null;
  /** store = اشتراك حقيقي عبر App Store / Google Play، sandbox = الدفع التجريبي. */
  source?: 'store' | 'sandbox';
  willRenew?: boolean;
};
export type Transaction = {
  id: string;
  plan: PlanId;
  amount: number;
  method: PaymentMethod;
  reference: string;
  last4?: string;
  at: number;
};

export const FREE_LIMITS = { courses: 5, decks: 2 } as const;

type State = {
  settings: Settings;
  courses: Course[];
  slots: Slot[];
  tasks: Task[];
  sessions: Session[];
  decks: Deck[];
  assessments: Assessment[];
  sections: Section[];
  students: Student[];
  attendance: AttendanceRecord[];
  gradeItems: GradeItem[];
  scores: Scores;
  officePage: OfficePage | null;
  myBookings: MyBooking[];
  gpa: GpaState;
  subscription: Subscription;
  transactions: Transaction[];
};

type Actions = {
  updateSettings: (p: Partial<Settings>) => void;
  addCourse: (c: Omit<Course, 'id'>) => string;
  updateCourse: (id: string, p: Partial<Course>) => void;
  deleteCourse: (id: string) => void;
  adjustAbsence: (id: string, delta: number) => void;
  addSlot: (s: Omit<Slot, 'id'>) => void;
  updateSlot: (id: string, p: Partial<Slot>) => void;
  deleteSlot: (id: string) => void;
  addTask: (t: Omit<Task, 'id' | 'done' | 'createdAt'>) => void;
  updateTask: (id: string, p: Partial<Task>) => void;
  toggleTask: (id: string) => void;
  deleteTask: (id: string) => void;
  logSession: (courseId: string | null, minutes: number) => void;
  addDeck: (title: string, courseId: string | null) => string;
  deleteDeck: (id: string) => void;
  addCard: (deckId: string, front: string, back: string) => void;
  deleteCard: (deckId: string, cardId: string) => void;
  reviewCard: (deckId: string, cardId: string, correct: boolean) => void;
  setGpa: (p: Partial<GpaState>) => void;
  addAssessment: (a: Omit<Assessment, 'id'>) => void;
  addSection: (courseId: string, code: string) => string;
  updateSection: (id: string, p: Partial<Section>) => void;
  deleteSection: (id: string) => void;
  addStudents: (sectionId: string, rows: RosterRow[]) => { added: number; skipped: number };
  updateStudent: (id: string, p: Partial<Student>) => void;
  deleteStudent: (id: string) => void;
  saveAttendance: (sectionId: string, date: string, absent: string[]) => void;
  importSchedule: (slots: ImportedSlot[], replace: boolean) => { courses: number; slots: number };
  addGradeItem: (sectionId: string, name: string, outOf: number) => string;
  deleteGradeItem: (id: string) => void;
  setScores: (itemId: string, values: Record<string, number | null>) => void;
  addTasks: (tasks: Omit<Task, 'id' | 'done' | 'createdAt'>[]) => void;
  setOfficePage: (p: OfficePage | null) => void;
  /** يطبّق قناة شعبة (انضمام أو تحديث) ويعيد ملخص التغييرات. */
  applyChannel: (ch: SectionChannel) => SyncResult;
  markChannelSeen: (courseId: string) => void;
  /** بعد حذف البيانات من الخادم: يزيل الروابط المحلية بما حُذف. */
  forgetCloudLinks: () => void;
  /** الطالب يغادر قناة الشعبة (حظر مصدر الإعلانات): تبقى المادة ومواعيدها، وتتوقف التحديثات. */
  leaveChannel: (courseId: string) => void;
  saveMyBooking: (b: MyBooking) => void;
  setBookingStatus: (id: string, status: MyBooking['status']) => void;
  startNewSemester: (o: { mergeGpa: boolean; clearSchedule: boolean; clearTasks: boolean; clearCourses: boolean }) => void;
  updateAssessment: (id: string, p: Partial<Assessment>) => void;
  deleteAssessment: (id: string) => void;
  activatePlan: (tx: Omit<Transaction, 'id' | 'at'>, months: number) => void;
  cancelSubscription: () => void;
  setStoreSubscription: (s: { active: boolean; until: number | null; plan: PlanId | null; willRenew: boolean }) => void;
  loadSampleData: () => void;
  restoreBackup: (d: BackupData) => void;
  resetAll: () => void;
};

const defaultSettings: Settings = {
  name: '',
  role: 'student',
  university: '',
  major: '',
  gradeScale: 5,
  theme: 'system',
  dailyGoalMin: 120,
  focusMin: 25,
  breakMin: 5,
  haptics: true,
  onboarded: false,
  remindersEnabled: false,
  lectureLeadMin: 15,
  remindersPromptDismissed: false,
  semesterWeeks: 15,
  reviewAskedAt: null,
  lastSeenVersion: '1.0.0',
  uniId: '',
  semesterStartedAt: null,
};

const initialState: State = {
  settings: defaultSettings,
  courses: [],
  slots: [],
  tasks: [],
  sessions: [],
  decks: [],
  assessments: [],
  sections: [],
  students: [],
  attendance: [],
  gradeItems: [],
  scores: {},
  officePage: null,
  myBookings: [],
  gpa: { prevGpa: 0, prevCredits: 0, rows: [] },
  subscription: { plan: 'free', until: null },
  transactions: [],
};

export const isPro = (s: Subscription, now = Date.now()) =>
  s.plan !== 'free' && s.until !== null && s.until > now;

export const useStore = create<State & Actions>()(
  persist(
    (set, get) => ({
      ...initialState,

      updateSettings: (p) => set((s) => ({ settings: { ...s.settings, ...p } })),

      addCourse: (c) => {
        const id = uid();
        set((s) => ({ courses: [...s.courses, { ...c, id }] }));
        return id;
      },
      updateCourse: (id, p) =>
        set((s) => ({ courses: s.courses.map((c) => (c.id === id ? { ...c, ...p } : c)) })),
      adjustAbsence: (id, delta) =>
        set((s) => ({
          courses: s.courses.map((c) => (c.id === id ? { ...c, absences: Math.max(0, (c.absences ?? 0) + delta) } : c)),
        })),
      deleteCourse: (id) =>
        set((s) => ({
          courses: s.courses.filter((c) => c.id !== id),
          slots: s.slots.filter((x) => x.courseId !== id),
          tasks: s.tasks.map((t) => (t.courseId === id ? { ...t, courseId: null } : t)),
          sessions: s.sessions.map((x) => (x.courseId === id ? { ...x, courseId: null } : x)),
          decks: s.decks.map((d) => (d.courseId === id ? { ...d, courseId: null } : d)),
          assessments: s.assessments.filter((a) => a.courseId !== id),
          sections: s.sections.filter((x) => x.courseId !== id),
          students: s.students.filter((x) => s.sections.some((q) => q.id === x.sectionId && q.courseId !== id)),
          attendance: s.attendance.filter((r) => s.sections.some((q) => q.id === r.sectionId && q.courseId !== id)),
          gradeItems: s.gradeItems.filter((g) => s.sections.some((q) => q.id === g.sectionId && q.courseId !== id)),
          scores: Object.fromEntries(
            Object.entries(s.scores).filter(([k]) => s.gradeItems.some((g) => k.startsWith(`${g.id}:`) && s.sections.some((q) => q.id === g.sectionId && q.courseId !== id))),
          ),
        })),

      addSlot: (x) => set((s) => ({ slots: [...s.slots, { ...x, id: uid() }] })),
      updateSlot: (id, p) =>
        set((s) => ({ slots: s.slots.map((x) => (x.id === id ? { ...x, ...p } : x)) })),
      deleteSlot: (id) => set((s) => ({ slots: s.slots.filter((x) => x.id !== id) })),

      addTask: (t) =>
        set((s) => ({ tasks: [...s.tasks, { ...t, id: uid(), done: false, createdAt: Date.now() }] })),
      updateTask: (id, p) =>
        set((s) => ({ tasks: s.tasks.map((t) => (t.id === id ? { ...t, ...p } : t)) })),
      toggleTask: (id) =>
        set((s) => ({
          tasks: s.tasks.map((t) =>
            t.id === id ? { ...t, done: !t.done, doneAt: !t.done ? Date.now() : undefined } : t,
          ),
        })),
      deleteTask: (id) => set((s) => ({ tasks: s.tasks.filter((t) => t.id !== id) })),

      logSession: (courseId, minutes) => {
        if (minutes < 1) return;
        set((s) => ({ sessions: [...s.sessions, { id: uid(), courseId, minutes, at: Date.now() }] }));
      },

      addDeck: (title, courseId) => {
        const id = uid();
        set((s) => ({ decks: [...s.decks, { id, title, courseId, cards: [], createdAt: Date.now() }] }));
        return id;
      },
      deleteDeck: (id) => set((s) => ({ decks: s.decks.filter((d) => d.id !== id) })),
      addCard: (deckId, front, back) =>
        set((s) => ({
          decks: s.decks.map((d) =>
            d.id === deckId
              ? { ...d, cards: [...d.cards, { id: uid(), front, back, box: 1, due: Date.now() }] }
              : d,
          ),
        })),
      deleteCard: (deckId, cardId) =>
        set((s) => ({
          decks: s.decks.map((d) =>
            d.id === deckId ? { ...d, cards: d.cards.filter((c) => c.id !== cardId) } : d,
          ),
        })),
      reviewCard: (deckId, cardId, correct) =>
        set((s) => ({
          decks: s.decks.map((d) =>
            d.id === deckId
              ? { ...d, cards: d.cards.map((c) => (c.id === cardId ? review(c, correct) : c)) }
              : d,
          ),
        })),

      setGpa: (p) => set((s) => ({ gpa: { ...s.gpa, ...p } })),

      addSection: (courseId, code) => {
        const id = uid();
        set((s) => ({ sections: [...s.sections, { id, courseId, code: code.trim() }] }));
        return id;
      },
      updateSection: (id, p) => set((s) => ({ sections: s.sections.map((x) => (x.id === id ? { ...x, ...p } : x)) })),
      deleteSection: (id) =>
        set((s) => ({
          sections: s.sections.filter((x) => x.id !== id),
          students: s.students.filter((x) => x.sectionId !== id),
          attendance: s.attendance.filter((x) => x.sectionId !== id),
          gradeItems: s.gradeItems.filter((x) => x.sectionId !== id),
          scores: Object.fromEntries(Object.entries(s.scores).filter(([k]) => s.gradeItems.some((g) => g.sectionId !== id && k.startsWith(`${g.id}:`)))),
          slots: s.slots.map((x) => (x.sectionId === id ? { ...x, sectionId: undefined } : x)),
        })),
      addStudents: (sectionId, rows) => {
        const existing = get().students.filter((x) => x.sectionId === sectionId);
        const keys = new Set(existing.flatMap((x) => [x.uniId, x.email].filter(Boolean)));
        const fresh: Student[] = [];
        let skipped = 0;
        for (const r of rows) {
          const k = [r.uniId, r.email].filter(Boolean);
          if (k.some((x) => keys.has(x))) {
            skipped++;
            continue;
          }
          k.forEach((x) => keys.add(x));
          fresh.push({ id: uid(), sectionId, ...r });
        }
        set((s) => ({ students: [...s.students, ...fresh] }));
        return { added: fresh.length, skipped };
      },
      updateStudent: (id, p) => set((s) => ({ students: s.students.map((x) => (x.id === id ? { ...x, ...p } : x)) })),
      deleteStudent: (id) =>
        set((s) => ({
          students: s.students.filter((x) => x.id !== id),
          attendance: s.attendance.map((r) => ({ ...r, absent: r.absent.filter((a) => a !== id) })),
          scores: Object.fromEntries(Object.entries(s.scores).filter(([k]) => !k.endsWith(`:${id}`))),
        })),
      saveAttendance: (sectionId, date, absent) =>
        set((s) => {
          const found = s.attendance.find((r) => r.sectionId === sectionId && r.date === date);
          return {
            attendance: found
              ? s.attendance.map((r) => (r === found ? { ...r, absent } : r))
              : [...s.attendance, { id: uid(), sectionId, date, absent }],
          };
        }),
      importSchedule: (imported, replace) => {
        const s = get();
        const courses = [...s.courses];
        const sections = [...s.sections];
        const norm = (x: string) => x.replace(/\s+/g, '').toLowerCase();
        let newCourses = 0;
        const courseFor = (code: string, name: string) => {
          if (!code && !name) return '';
          const hit = courses.find((c) => (code && norm(c.code) === norm(code)) || norm(c.name) === norm(name) || (code && norm(c.name) === norm(code)));
          if (hit) return hit.id;
          const looksLikeCode = /[A-Za-z]+\s*\d/.test(code) && code !== name;
          const c: Course = {
            id: uid(),
            name: name || code,
            code: looksLikeCode ? code.toUpperCase() : '',
            color: courseColors[courses.length % courseColors.length],
            credits: 3,
            instructor: '',
          };
          courses.push(c);
          newCourses++;
          return c.id;
        };
        const newSlots: Slot[] = imported.map((x) => {
          const courseId = courseFor(x.course, x.courseName);
          let sectionId: string | undefined;
          if (x.section && courseId) {
            const sec = sections.find((q) => q.courseId === courseId && q.code === x.section) ?? { id: uid(), courseId, code: x.section };
            if (!sections.includes(sec)) sections.push(sec);
            sectionId = sec.id;
          }
          return { id: uid(), courseId, sectionId, day: x.day, start: x.start, end: x.end, room: x.room, type: x.type };
        });
        set({ courses, sections, slots: replace ? newSlots : [...s.slots, ...newSlots] });
        return { courses: newCourses, slots: newSlots.length };
      },

      addGradeItem: (sectionId, name, outOf) => {
        const id = uid();
        set((s) => ({ gradeItems: [...s.gradeItems, { id, sectionId, name: name.trim(), outOf }] }));
        return id;
      },
      deleteGradeItem: (id) =>
        set((s) => ({
          gradeItems: s.gradeItems.filter((x) => x.id !== id),
          scores: Object.fromEntries(Object.entries(s.scores).filter(([k]) => !k.startsWith(`${id}:`))),
        })),
      setScores: (itemId, values) =>
        set((s) => {
          const scores = { ...s.scores };
          for (const [studentId, v] of Object.entries(values)) {
            if (v === null || !Number.isFinite(v)) delete scores[scoreKey(itemId, studentId)];
            else scores[scoreKey(itemId, studentId)] = v;
          }
          return { scores };
        }),
      setOfficePage: (p) => set({ officePage: p }),
      applyChannel: (ch) => {
        const s = get();
        const r = syncChannel({ courses: s.courses, slots: s.slots, tasks: s.tasks }, ch, Date.now());
        set({ courses: r.courses, slots: r.slots, tasks: r.tasks });
        return r;
      },
      leaveChannel: (courseId) =>
        set((s) => {
          const code = s.courses.find((c) => c.id === courseId)?.channel?.code;
          return {
            courses: s.courses.map(({ channel, ...c }) => (c.id === courseId ? c : { ...c, channel })),
            // المواعيد تصير مواعيد الطالب العادية (لا تُستبدل ولا تُحذف بعد الآن)
            slots: s.slots.map(({ channelCode, ...x }) => (code && channelCode === code ? x : { ...x, channelCode })),
            tasks: s.tasks.map(({ channelKey, ...t }) => (code && channelKey?.startsWith(`${code}|`) ? t : { ...t, channelKey })),
          };
        }),
      forgetCloudLinks: () =>
        set((s) => ({ officePage: null, myBookings: [], sections: s.sections.map(({ channel: _c, ...rest }) => rest) })),
      markChannelSeen: (courseId) =>
        set((s) => ({
          courses: s.courses.map((c) =>
            c.id === courseId && c.channel?.posts.length ? { ...c, channel: { ...c.channel, seenAt: c.channel.posts[0].created_at > c.channel.seenAt ? c.channel.posts[0].created_at : c.channel.seenAt } } : c,
          ),
        })),
      saveMyBooking: (b) => set((s) => ({ myBookings: [...s.myBookings.filter((x) => x.id !== b.id), b].sort((a, c) => a.startsAt.localeCompare(c.startsAt)) })),
      setBookingStatus: (id, status) => set((s) => ({ myBookings: s.myBookings.map((x) => (x.id === id ? { ...x, status } : x)) })),
      addTasks: (list) =>
        set((s) => ({ tasks: [...s.tasks, ...list.map((t) => ({ ...t, id: uid(), done: false, createdAt: Date.now() }))] })),
      startNewSemester: ({ mergeGpa, clearSchedule, clearTasks, clearCourses }) =>
        set((s) => {
          const next: Partial<State> = { settings: { ...s.settings, semesterStartedAt: Date.now() } };
          if (mergeGpa && s.gpa.rows.length) {
            const r = closeSemester(s.gpa.prevGpa, s.gpa.prevCredits, s.gpa.rows, s.settings.gradeScale);
            next.gpa = { prevGpa: r.prevGpa, prevCredits: r.prevCredits, rows: [] };
          }
          if (clearSchedule || clearCourses) next.slots = [];
          if (clearTasks) next.tasks = [];
          if (clearCourses) {
            Object.assign(next, { courses: [], assessments: [], sections: [], students: [], attendance: [], gradeItems: [], scores: {} });
            next.decks = s.decks.map((d) => ({ ...d, courseId: null }));
            if (!clearTasks) next.tasks = s.tasks.map((t) => ({ ...t, courseId: null }));
          } else {
            // فصل جديد: يُصفّر الغياب ويُبقي المقررات
            next.courses = s.courses.map((c) => ({ ...c, absences: 0 }));
            next.attendance = [];
          }
          return next;
        }),

      addAssessment: (a) => set((s) => ({ assessments: [...s.assessments, { ...a, id: uid() }] })),
      updateAssessment: (id, p) =>
        set((s) => ({ assessments: s.assessments.map((a) => (a.id === id ? { ...a, ...p } : a)) })),
      deleteAssessment: (id) => set((s) => ({ assessments: s.assessments.filter((a) => a.id !== id) })),

      activatePlan: (tx, months) => {
        const now = Date.now();
        const cur = get().subscription;
        const base = isPro(cur, now) && cur.until ? cur.until : now;
        const until = new Date(base);
        until.setMonth(until.getMonth() + months);
        set((s) => ({
          subscription: { plan: tx.plan, until: until.getTime(), source: 'sandbox' },
          transactions: [{ ...tx, id: uid(), at: now }, ...s.transactions],
        }));
      },
      cancelSubscription: () => set({ subscription: { plan: 'free', until: null } }),
      setStoreSubscription: ({ active, until, plan, willRenew }) =>
        set({
          subscription: active && plan
            ? { plan, until: until ?? Date.now() + 365 * 86_400_000, source: 'store', willRenew }
            : { plan: 'free', until: null, source: 'store' },
        }),

      loadSampleData: () => {
        const today = new Date();
        const c1 = uid(), c2 = uid(), c3 = uid(), c4 = uid();
        const courses: Course[] = [
          { id: c1, name: 'هياكل البيانات', code: 'CS 2301', color: courseColors[0], credits: 3, instructor: 'د. خالد العتيبي' },
          { id: c2, name: 'التفاضل والتكامل 2', code: 'MATH 1302', color: courseColors[1], credits: 4, instructor: 'د. سارة الحربي' },
          { id: c3, name: 'الفيزياء العامة', code: 'PHYS 1101', color: courseColors[2], credits: 3, instructor: 'د. فهد الزهراني' },
          { id: c4, name: 'مهارات الكتابة', code: 'ARAB 1001', color: courseColors[3], credits: 2, instructor: 'د. نورة القحطاني' },
        ];
        const slots: Slot[] = [
          { id: uid(), courseId: c1, day: 0, start: 8 * 60, end: 9 * 60 + 40, room: 'مبنى 5 · قاعة 204', type: 'lecture' },
          { id: uid(), courseId: c2, day: 0, start: 10 * 60, end: 11 * 60 + 40, room: 'مبنى 3 · قاعة 110', type: 'lecture' },
          { id: uid(), courseId: c3, day: 1, start: 9 * 60, end: 10 * 60 + 40, room: 'مبنى 7 · قاعة 12', type: 'lecture' },
          { id: uid(), courseId: c3, day: 3, start: 13 * 60, end: 15 * 60, room: 'معمل الفيزياء 2', type: 'lab' },
          { id: uid(), courseId: c1, day: 2, start: 8 * 60, end: 9 * 60 + 40, room: 'مبنى 5 · قاعة 204', type: 'lecture' },
          { id: uid(), courseId: c2, day: 2, start: 11 * 60, end: 12 * 60 + 40, room: 'مبنى 3 · قاعة 110', type: 'lecture' },
          { id: uid(), courseId: c4, day: 4, start: 10 * 60, end: 11 * 60 + 40, room: 'مبنى 1 · قاعة 8', type: 'lecture' },
        ];
        // حصتان إضافيتان اليوم حتى تظهر «الآن / التالية» في الرئيسية، في أول وقت لا يتعارض مع جدول اليوم.
        const d = today.getDay();
        const extras: Omit<Slot, 'id' | 'day' | 'start' | 'end'>[] = [
          { courseId: c1, room: 'مبنى 5 · قاعة 204', type: 'lecture' },
          { courseId: c2, room: 'مكتب 3-214', type: 'office' },
        ];
        let from = 8 * 60;
        for (const x of extras) {
          while (from + 90 <= 22 * 60 && slots.some((s) => s.day === d && s.start < from + 90 && from < s.end)) from += 30;
          if (from + 90 > 22 * 60) break;
          slots.push({ ...x, id: uid(), day: d, start: from, end: from + 90 });
          from += 120;
        }
        const k = (n: number) => toDateKey(addDays(today, n));
        const tasks: Task[] = [
          { id: uid(), title: 'واجب القوائم المترابطة', courseId: c1, type: 'assignment', due: k(1), priority: 3, notes: 'تسليم على البلاك بورد', done: false, createdAt: Date.now() },
          { id: uid(), title: 'اختبار قصير: التكامل بالتجزئة', courseId: c2, type: 'quiz', due: k(3), priority: 2, notes: '', done: false, createdAt: Date.now() },
          { id: uid(), title: 'الاختبار الفصلي الأول', courseId: c3, type: 'exam', due: k(8), priority: 3, notes: 'الفصول 1 – 4', done: false, createdAt: Date.now() },
          { id: uid(), title: 'قراءة الفصل الخامس', courseId: c4, type: 'reading', due: k(0), priority: 1, notes: '', done: false, createdAt: Date.now() },
          { id: uid(), title: 'تقرير تجربة البندول', courseId: c3, type: 'project', due: k(-1), priority: 2, notes: '', done: true, createdAt: Date.now(), doneAt: Date.now() },
        ];
        const sessions: Session[] = [];
        for (let i = 6; i >= 0; i--) {
          const at = addDays(today, -i).getTime();
          const mins = [45, 80, 30, 110, 60, 95, 50][i];
          sessions.push({ id: uid(), courseId: [c1, c2, c3, c4][i % 4], minutes: mins, at });
        }
        const now = Date.now();
        const decks: Deck[] = [
          {
            id: uid(), title: 'مصطلحات هياكل البيانات', courseId: c1, createdAt: now,
            cards: [
              { id: uid(), front: 'ما تعقيد البحث الثنائي؟', back: 'O(log n)', box: 1, due: now },
              { id: uid(), front: 'ما الفرق بين المكدس والطابور؟', back: 'المكدس LIFO: آخر داخل أول خارج\nالطابور FIFO: أول داخل أول خارج', box: 2, due: now },
              { id: uid(), front: 'ما الشجرة الثنائية المتوازنة؟', back: 'شجرة لا يزيد فرق ارتفاع فرعيها عن 1 عند كل عقدة', box: 1, due: now },
            ],
          },
        ];
        set({ courses, slots, tasks, sessions, decks });
      },

      restoreBackup: (d) =>
        set((s) => ({
          settings: { ...defaultSettings, ...d.settings, onboarded: true },
          courses: d.courses,
          slots: d.slots,
          tasks: d.tasks,
          sessions: d.sessions,
          decks: d.decks,
          assessments: d.assessments,
          sections: d.sections,
          students: d.students,
          attendance: d.attendance,
          gradeItems: d.gradeItems,
          scores: d.scores,
          gpa: d.gpa,
          // الاشتراك والمدفوعات تبقى كما هي على هذا الجهاز
          subscription: s.subscription,
          transactions: s.transactions,
        })),

      resetAll: () => set({ ...initialState, settings: { ...defaultSettings } }),
    }),
    {
      name: 'mudhaker-store',
      version: 1,
      storage: createJSONStorage(() => AsyncStorage),
      // دمج عميق للإعدادات حتى تأخذ الحقول الجديدة قيمها الافتراضية عند تحديث التطبيق.
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<State>;
        return { ...current, ...p, settings: { ...current.settings, ...p.settings } };
      },
    },
  ),
);

/** يعيد true بعد استرجاع البيانات المحفوظة من الجهاز. */
export function useHydrated() {
  return useSyncExternalStore(
    (cb) => useStore.persist.onFinishHydration(cb),
    () => useStore.persist.hasHydrated(),
    () => false,
  );
}
