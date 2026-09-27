/**
 * منطق مؤقت المذاكرة: مدة حرة، وإضافة وقت أثناء الجلسة، ووضع «وقت مفتوح» يعدّ تصاعدياً.
 */

export const FOCUS_MIN = 5;
export const FOCUS_MAX = 240;
export const BREAK_MAX = 60;
/** أزرار إضافة الوقت أثناء الجلسة (بالدقائق). */
export const EXTEND_OPTIONS = [5, 10, 15] as const;
/** حلقة الوقت المفتوح تكتمل كل 25 دقيقة (جولة بومودورو). */
export const OPEN_ROUND_SEC = 25 * 60;

export const clampFocus = (m: number) => Math.min(FOCUS_MAX, Math.max(FOCUS_MIN, Math.round(m)));

export type TimerState = { status: 'idle' | 'running' | 'paused'; endAt: number | null; left: number; extra: number };

/**
 * يضيف دقائق للجلسة الجارية أو الموقوفة مؤقتاً (أو يطرحها بقيمة سالبة، دون أن يقل المتبقي عن دقيقة).
 * extra يحفظ مجموع ما أُضيف حتى تبقى الحلقة صحيحة، ولا تتجاوز الجلسة الحد الأقصى.
 */
export function extendTimer(s: TimerState, minutes: number, baseSec: number, now = Date.now()): TimerState {
  if (s.status === 'idle') return s;
  const left = s.status === 'running' && s.endAt !== null ? Math.max(0, Math.round((s.endAt - now) / 1000)) : s.left;
  const maxAdd = FOCUS_MAX * 60 - (baseSec + s.extra);
  const add = Math.max(Math.min(minutes * 60, maxAdd), 60 - left);
  const nextLeft = left + add;
  if (add === 0) return s;
  return {
    status: s.status,
    left: nextLeft,
    endAt: s.status === 'running' ? now + nextLeft * 1000 : s.endAt,
    extra: s.extra + add,
  };
}

/** تقدّم حلقة الوقت المفتوح: تمتلئ كل جولة 25 دقيقة ثم تبدأ من جديد. */
export const openProgress = (elapsedSec: number) => (elapsedSec % OPEN_ROUND_SEC) / OPEN_ROUND_SEC;
