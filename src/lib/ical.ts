/**
 * استيراد مواعيد Blackboard (أو أي نظام تعليم) من رابط التقويم iCal الخاص بالطالب.
 * الرابط يُجلب من جوال الطالب مباشرة ولا يمر بخادمنا لأنه رابط خاص به.
 * دوال نقية: قراءة ملف ics، وتحويل أحداثه إلى مهام، ودمجها دون تكرار.
 */
import type { Course, Task, TaskType } from '@/store/useStore';
import { toDateKey } from './dates';
import { uid } from './id';

export type IcsEvent = { uid: string; summary: string; start: Date; allDay: boolean; location: string; description: string; categories: string };

/** حدود أمان: حجم الملف وعدد الأحداث (ملف ضخم أو خبيث لا يعلّق التطبيق). */
export const MAX_ICS_BYTES = 2_000_000;
export const MAX_EVENTS = 500;

const unescape = (v: string) => v.replace(/\\n/gi, '\n').replace(/\\([,;\\])/g, '$1').trim();

/** تاريخ iCal: 20261020 أو 20261020T205900Z أو 20261020T235900 (بتوقيت الجهاز). */
export function parseIcsDate(v: string): { date: Date; allDay: boolean } | null {
  const m = /^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})?(Z)?)?$/.exec(v.trim());
  if (!m) return null;
  const [, y, mo, d, h, mi, s, z] = m;
  if (h === undefined) return { date: new Date(+y, +mo - 1, +d), allDay: true };
  const args = [+y, +mo - 1, +d, +h, +mi, +(s ?? 0)] as const;
  return { date: z ? new Date(Date.UTC(...args)) : new Date(...args), allDay: false };
}

export function parseIcs(text: string): IcsEvent[] {
  if (text.length > MAX_ICS_BYTES) throw new Error('ics_too_large');
  // فك الأسطر المطوية: السطر الذي يبدأ بمسافة تكملة للسابق
  const lines = text.replace(/\r\n/g, '\n').replace(/\n[ \t]/g, '').split('\n');
  const out: IcsEvent[] = [];
  let cur: Record<string, string> | null = null;
  for (const line of lines) {
    if (/^BEGIN:(VEVENT|VTODO)$/i.test(line.trim())) cur = {};
    else if (/^END:(VEVENT|VTODO)$/i.test(line.trim())) {
      if (cur) {
        const when = parseIcsDate(cur.DUE ?? cur.DTSTART ?? '');
        const summary = unescape(cur.SUMMARY ?? '');
        if (when && summary) {
          out.push({ uid: (cur.UID ?? `${summary}|${when.date.toISOString()}`).slice(0, 200), summary: summary.slice(0, 200), start: when.date, allDay: when.allDay, location: unescape(cur.LOCATION ?? '').slice(0, 200), description: unescape(cur.DESCRIPTION ?? '').slice(0, 1000), categories: unescape(cur.CATEGORIES ?? '').slice(0, 200) });
          if (out.length >= MAX_EVENTS) break;
        }
      }
      cur = null;
    } else if (cur) {
      const i = line.indexOf(':');
      if (i > 0) {
        const key = line.slice(0, i).split(';')[0].toUpperCase();
        if (!(key in cur)) cur[key] = line.slice(i + 1);
      }
    }
  }
  return out;
}

/** نوع المهمة من عنوانها (عربي أو إنجليزي). */
export function inferType(text: string): TaskType {
  const t = text.toLowerCase();
  if (/(final|midterm|exam|test|اختبار(?! قصير)|امتحان|نهائي|فصلي)/.test(t)) return 'exam';
  if (/(quiz|كويز|اختبار قصير)/.test(t)) return 'quiz';
  if (/(project|مشروع)/.test(t)) return 'project';
  if (/(read|قراءة)/.test(t)) return 'reading';
  return 'assignment';
}

const norm = (s: string) => s.toUpperCase().replace(/[^A-Z0-9؀-ۿ]/g, '');

/** يربط الحدث بمادة: برمز المقرر (مثل CS 2301 أو CS2301) أو باسمه في العنوان أو المكان أو الوصف. */
export function matchCourse(e: IcsEvent, courses: Course[]): string | null {
  const hay = norm(`${e.summary} ${e.location} ${e.categories} ${e.description.slice(0, 300)}`);
  const byCode = courses.find((c) => c.code && norm(c.code).length >= 4 && hay.includes(norm(c.code)));
  if (byCode) return byCode.id;
  const byName = courses.find((c) => norm(c.name).length >= 4 && hay.includes(norm(c.name)));
  return byName?.id ?? null;
}

export type IcsImport = { tasks: Task[]; added: number; updated: number; skipped: number };

/**
 * يدمج الأحداث في المهام: المواعيد القادمة فقط (خلال 180 يوماً)، دون تكرار (بمعرّف الحدث)،
 * ويحدّث التاريخ أو العنوان إن تغيّر في Blackboard، ولا يلمس ما أنجزه الطالب أو كتبه بنفسه.
 */
export function mergeIcs(tasks: Task[], events: IcsEvent[], courses: Course[], feedId: string, now: Date): IcsImport {
  const today = toDateKey(now);
  const horizon = toDateKey(new Date(now.getTime() + 180 * 86_400_000));
  const next = [...tasks];
  let added = 0;
  let updated = 0;
  let skipped = 0;
  for (const e of events) {
    const due = toDateKey(e.start);
    if (due < today || due > horizon) {
      skipped++;
      continue;
    }
    const key = `ics:${feedId}:${e.uid}`;
    const i = next.findIndex((t) => t.sourceKey === key);
    const type = inferType(`${e.summary} ${e.categories}`);
    if (i >= 0) {
      const t = next[i];
      if (!t.done && (t.due !== due || t.title !== e.summary)) {
        next[i] = { ...t, due, title: e.summary };
        updated++;
      }
      continue;
    }
    next.push({ id: uid(), title: e.summary, courseId: matchCourse(e, courses), type, due, priority: type === 'exam' ? 3 : 2, notes: 'من تقويم Blackboard', done: false, createdAt: now.getTime(), sourceKey: key });
    added++;
  }
  return { tasks: next, added, updated, skipped };
}

/** يقبل روابط webcal:// و https:// فقط (ولا يقبل http غير المشفر). */
export function normalizeFeedUrl(raw: string): string | null {
  const v = raw.trim().replace(/^webcals?:\/\//i, 'https://');
  try {
    const u = new URL(v);
    return u.protocol === 'https:' && u.hostname.includes('.') ? u.toString() : null;
  } catch {
    return null;
  }
}
