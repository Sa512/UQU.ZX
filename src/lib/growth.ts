/**
 * أدوات النمو: مشاركة التطبيق وطلب التقييم في لحظة إيجابية.
 * التقييم يُطلب بعد أن يستفيد المستخدم فعلاً (٣ جلسات مذاكرة و٣ مهام منجزة)،
 * ومرة كل ٩٠ يوماً كحد أقصى — والنظام نفسه يحدّ من ظهوره (Apple: ٣ مرات سنوياً).
 */
import * as StoreReview from 'expo-store-review';
import { Platform, Share } from 'react-native';
import { APP_INFO } from '@/content/app';
import { useStore } from '@/store/useStore';

export const SHARE_MESSAGE = `جرّب تطبيق «${APP_INFO.name}» 📚 — ينظّم جدولك الجامعي ومهامك، ويحسب معدلك وغيابك، ويذكّرك قبل المحاضرات والاختبارات.\n${APP_INFO.siteUrl}`;

export async function shareApp(): Promise<boolean> {
  try {
    const r = await Share.share({ message: SHARE_MESSAGE, title: APP_INFO.name });
    return r.action === Share.sharedAction;
  } catch {
    return false;
  }
}

const REVIEW_GAP_MS = 90 * 86_400_000;

/** شرط طلب التقييم (دالة نقية قابلة للاختبار). */
export function shouldAskReview(p: { sessions: number; doneTasks: number; lastAsked: number | null; now: number }): boolean {
  if (p.sessions < 3 || p.doneTasks < 3) return false;
  return p.lastAsked === null || p.now - p.lastAsked > REVIEW_GAP_MS;
}

export async function maybeAskReview(): Promise<void> {
  if (Platform.OS === 'web') return;
  const s = useStore.getState();
  const now = Date.now();
  const ok = shouldAskReview({
    sessions: s.sessions.length,
    doneTasks: s.tasks.filter((t) => t.done).length,
    lastAsked: s.settings.reviewAskedAt,
    now,
  });
  if (!ok) return;
  try {
    if (!(await StoreReview.hasAction())) return;
    s.updateSettings({ reviewAskedAt: now });
    await StoreReview.requestReview();
  } catch {
    // لا شيء: التقييم اختياري
  }
}
