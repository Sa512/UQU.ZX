import { useEffect } from 'react';
import { useStore } from '@/store/useStore';
import { fetchIcs } from './icsFetch';

export const FEED_SYNC_MS = 6 * 60 * 60_000;

/** يحدّث تقاويم Blackboard في الخلفية عند فتح الرئيسية (مرة كل 6 ساعات لكل تقويم). */
export function useFeedSync() {
  useEffect(() => {
    let cancelled = false;
    Promise.resolve().then(async () => {
      const now = Date.now();
      for (const f of useStore.getState().feeds.filter((x) => now - (x.lastSync ?? 0) >= FEED_SYNC_MS)) {
        if (cancelled) return;
        try {
          const events = await fetchIcs(f.url);
          if (!cancelled) useStore.getState().applyIcs(f.id, events);
        } catch {
          // بلا إنترنت أو رابط منتهٍ: يظهر الخطأ عند التحديث اليدوي
        }
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);
}
