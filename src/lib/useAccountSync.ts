import { useEffect } from 'react';
import { AppState } from 'react-native';
import { useStore } from '@/store/useStore';
import { cloud, CloudError } from './cloud';

/**
 * يحدّث ملف الحساب من الخادم عند فتح التطبيق والعودة إليه: موافقة المشرف أو رفضه تظهر فوراً،
 * والجلسة المنتهية أو الحساب المحذوف يعيدان المستخدم لتسجيل الدخول. انقطاع الإنترنت لا يُخرج أحداً.
 */
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
      } catch (e) {
        if (e instanceof CloudError && e.code === 'not_signed_in') useStore.getState().setAccount(null);
      }
    };
    Promise.resolve().then(sync);
    const sub = AppState.addEventListener('change', (s) => s === 'active' && sync());
    return () => sub.remove();
  }, []);
}
