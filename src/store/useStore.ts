import { useSyncExternalStore } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { courseColors } from '@/theme/colors';
import { addDays, toDateKey } from '@/lib/dates';
import type { Grade, GradeScale } from '@/lib/gpa';
import { uid } from '@/lib/id';
import type { PaymentMethod, PlanId } from '@/lib/payments';
import { review } from '@/lib/srs';

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
};

export type Course = {
  id: string;
  name: string;
  code: string;
  color: string;
  credits: number;
  instructor: string;
};

export type SlotType = 'lecture' | 'lab' | 'office';
export type Slot = {
  id: string;
  courseId: string;
  day: number; // 0 = الأحد
  start: number; // دقائق منذ منتصف الليل
  end: number;
  room: string;
  type: SlotType;
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
};

export type Session = { id: string; courseId: string | null; minutes: number; at: number };

export type Card = { id: string; front: string; back: string; box: number; due: number };
export type Deck = { id: string; title: string; courseId: string | null; cards: Card[]; createdAt: number };

export type GpaRow = { id: string; name: string; credits: number; grade: Grade };
export type GpaState = { prevGpa: number; prevCredits: number; rows: GpaRow[] };

export type Subscription = {
  plan: 'free' | PlanId;
  until: number | null;
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
  gpa: GpaState;
  subscription: Subscription;
  transactions: Transaction[];
};

type Actions = {
  updateSettings: (p: Partial<Settings>) => void;
  addCourse: (c: Omit<Course, 'id'>) => string;
  updateCourse: (id: string, p: Partial<Course>) => void;
  deleteCourse: (id: string) => void;
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
  activatePlan: (tx: Omit<Transaction, 'id' | 'at'>, months: number) => void;
  cancelSubscription: () => void;
  loadSampleData: () => void;
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
};

const initialState: State = {
  settings: defaultSettings,
  courses: [],
  slots: [],
  tasks: [],
  sessions: [],
  decks: [],
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
      deleteCourse: (id) =>
        set((s) => ({
          courses: s.courses.filter((c) => c.id !== id),
          slots: s.slots.filter((x) => x.courseId !== id),
          tasks: s.tasks.map((t) => (t.courseId === id ? { ...t, courseId: null } : t)),
          sessions: s.sessions.map((x) => (x.courseId === id ? { ...x, courseId: null } : x)),
          decks: s.decks.map((d) => (d.courseId === id ? { ...d, courseId: null } : d)),
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

      activatePlan: (tx, months) => {
        const now = Date.now();
        const cur = get().subscription;
        const base = isPro(cur, now) && cur.until ? cur.until : now;
        const until = new Date(base);
        until.setMonth(until.getMonth() + months);
        set((s) => ({
          subscription: { plan: tx.plan, until: until.getTime() },
          transactions: [{ ...tx, id: uid(), at: now }, ...s.transactions],
        }));
      },
      cancelSubscription: () => set({ subscription: { plan: 'free', until: null } }),

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
          { id: uid(), courseId: c1, day: today.getDay(), start: 12 * 60, end: 13 * 60 + 30, room: 'مبنى 5 · قاعة 204', type: 'lecture' },
          { id: uid(), courseId: c2, day: today.getDay(), start: 14 * 60, end: 15 * 60, room: 'مكتب 3-214', type: 'office' },
        ];
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
