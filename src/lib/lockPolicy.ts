/** يُقفل التطبيق إذا بقي في الخلفية أكثر من 30 ثانية (يسمح بتبديل سريع لتطبيق آخر دون إزعاج). */
export const RELOCK_AFTER_MS = 30_000;

export function shouldRelock(backgroundedAt: number | null, now: number, enabled: boolean): boolean {
  if (!enabled || backgroundedAt === null) return false;
  return now - backgroundedAt >= RELOCK_AFTER_MS;
}
