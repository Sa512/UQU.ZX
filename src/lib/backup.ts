/**
 * النسخ الاحتياطي: ملف JSON يحفظه المستخدم (iCloud / Drive / واتساب) ويستعيده على جهاز جديد.
 * لا يشمل الاشتراك — الاشتراك مرتبط بحساب المتجر ويُستعاد بزر «استعادة المشتريات».
 */
import type { Course, Deck, GpaState, Session, Settings, Slot, Task } from '@/store/useStore';
import type { Assessment } from './grades';

export const BACKUP_APP = 'mudhaker';
export const BACKUP_VERSION = 1;

export type BackupData = {
  settings: Partial<Settings>;
  courses: Course[];
  slots: Slot[];
  tasks: Task[];
  sessions: Session[];
  decks: Deck[];
  assessments: Assessment[];
  gpa: GpaState;
};

export type BackupFile = { app: typeof BACKUP_APP; version: number; exportedAt: string; data: BackupData };

export function buildBackup(data: BackupData, now = new Date()): BackupFile {
  return { app: BACKUP_APP, version: BACKUP_VERSION, exportedAt: now.toISOString(), data };
}

export const backupFileName = (now = new Date()) =>
  `mudhaker-backup-${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}.json`;

const isArr = (x: unknown): x is unknown[] => Array.isArray(x);

export type ParseResult = { ok: true; data: BackupData; summary: string } | { ok: false; message: string };

export function parseBackup(text: string): ParseResult {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { ok: false, message: 'الملف ليس نسخة احتياطية صالحة.' };
  }
  const f = raw as Partial<BackupFile>;
  if (!f || f.app !== BACKUP_APP || typeof f.version !== 'number' || !f.data) {
    return { ok: false, message: 'هذا الملف ليس نسخة احتياطية من تطبيق مذاكر.' };
  }
  if (f.version > BACKUP_VERSION) return { ok: false, message: 'النسخة من إصدار أحدث للتطبيق. حدّث مذاكر ثم أعد المحاولة.' };
  const d = f.data;
  if (![d.courses, d.slots, d.tasks, d.sessions, d.decks].every(isArr)) {
    return { ok: false, message: 'الملف ناقص أو تالف.' };
  }
  const data: BackupData = {
    settings: d.settings && typeof d.settings === 'object' ? d.settings : {},
    courses: d.courses,
    slots: d.slots,
    tasks: d.tasks,
    sessions: d.sessions,
    decks: d.decks,
    assessments: isArr(d.assessments) ? d.assessments : [],
    gpa: d.gpa && isArr(d.gpa.rows) ? d.gpa : { prevGpa: 0, prevCredits: 0, rows: [] },
  };
  const summary = `${data.courses.length} مقرر، ${data.tasks.length} مهمة، ${data.decks.length} مجموعة بطاقات`;
  return { ok: true, data, summary };
}
