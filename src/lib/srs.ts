/**
 * التكرار المتباعد بنظام صناديق لايتنر (٥ صناديق).
 * الإجابة الصحيحة ترفع البطاقة صندوقاً، والخاطئة تعيدها للأول.
 */
export const BOX_INTERVAL_DAYS = [0, 1, 2, 4, 7, 14];
export const MAX_BOX = 5;

export type ReviewCard = { box: number; due: number };

export function review<T extends ReviewCard>(card: T, correct: boolean, now = Date.now()): T {
  const box = correct ? Math.min(card.box + 1, MAX_BOX) : 1;
  return { ...card, box, due: now + BOX_INTERVAL_DAYS[box] * 86_400_000 };
}

export const isDue = (c: ReviewCard, now = Date.now()) => c.due <= now;

/** نسبة الإتقان: متوسط الصناديق منسوباً للحد الأعلى. */
export function mastery(cards: ReviewCard[]): number {
  if (!cards.length) return 0;
  const sum = cards.reduce((a, c) => a + (c.box - 1), 0);
  return sum / (cards.length * (MAX_BOX - 1));
}
