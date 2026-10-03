import { useEffect } from 'react';
import { AppState } from 'react-native';
import { useStore } from '@/store/useStore';
import { refreshWidget, widgetsSupported } from './widgetSync';

/** يحدّث الويدجت عند تغيّر الجدول أو المهام أو المذاكرة، وعند العودة للتطبيق (بتأخير بسيط لتجميع التغييرات). */
export function useWidgetSync() {
  useEffect(() => {
    if (!widgetsSupported) return;
    let t: ReturnType<typeof setTimeout> | undefined;
    const later = () => {
      clearTimeout(t);
      t = setTimeout(() => refreshWidget(), 1500);
    };
    later();
    const unsub = useStore.subscribe((s, prev) => {
      if (s.courses !== prev.courses || s.slots !== prev.slots || s.tasks !== prev.tasks || s.sessions !== prev.sessions || s.settings.dailyGoalMin !== prev.settings.dailyGoalMin || s.settings.role !== prev.settings.role) later();
    });
    const sub = AppState.addEventListener('change', (st) => st !== 'active' && refreshWidget());
    return () => {
      clearTimeout(t);
      unsub();
      sub.remove();
    };
  }, []);
}
