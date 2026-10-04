import { useEffect } from 'react';
import { AppState } from 'react-native';
import { useStore } from '@/store/useStore';
import { cloud } from './cloud';

/** يجلب التحكم الطارئ عند الفتح والعودة وكل 15 دقيقة. دون اتصال يبقى آخر ما عُرف. */
export function useAppConfigSync() {
  useEffect(() => {
    const sync = () =>
      cloud
        .getAppConfig()
        .then((c) => c && useStore.getState().setRemoteConfig(c))
        .catch(() => {});
    Promise.resolve().then(sync);
    const t = setInterval(sync, 15 * 60_000);
    const sub = AppState.addEventListener('change', (s) => s === 'active' && sync());
    return () => {
      clearInterval(t);
      sub.remove();
    };
  }, []);
}
