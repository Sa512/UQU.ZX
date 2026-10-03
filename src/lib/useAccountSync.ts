import { useEffect } from 'react';
import { AppState } from 'react-native';
import { useStore } from '@/store/useStore';
import { cloud, CloudError } from './cloud';
import { reconcileBookings } from './bookingSync';

/**
 * يحدّث ملف الحساب من الخادم عند فتح التطبيق والعودة إليه: موافقة المشرف أو رفضه تظهر فوراً،
 * والجلسة المنتهية أو الحساب المحذوف يعيدان المستخدم لتسجيل الدخول. انقطاع الإنترنت لا يُخرج أحداً.
 * ومعه تُطابق حجوزات الطالب القادمة: إن ألغاها الدكتور تُلغى هنا ويختفي تذكيرها.
 */
export async function syncBookings(now = Date.now()) {
  const local = useStore.getState().myBookings;
  if (!local.some((b) => b.status === 'booked' && new Date(b.startsAt).getTime() > now)) return;
  const { next, changed } = reconcileBookings(local, await cloud.myBookings());
  if (changed) useStore.getState().replaceMyBookings(next);
}

export function useAccountSync() {
  useEffect(() => {
    const sync = async () => {
      if (!useStore.getState().account) return;
      try {
        const p = await cloud.myProfile();
        const cur = useStore.getState().account;
        if (!cur) return;
        if (!p) return useStore.getState().setAccount(null);
        if (JSON.stringify(p) !== JSON.stringify(cur)) useStore.getState().setAccount(p);
        await syncBookings();
      } catch (e) {
        if (e instanceof CloudError && e.code === 'not_signed_in') useStore.getState().setAccount(null);
      }
    };
    Promise.resolve().then(sync);
    const sub = AppState.addEventListener('change', (s) => s === 'active' && sync());
    return () => sub.remove();
  }, []);
}
