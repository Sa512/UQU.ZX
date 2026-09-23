import { useEffect } from 'react';
import { useStore } from '@/store/useStore';
import { applyReminders, cancelAllReminders, remindersSupported, requestReminderPermission } from './notifications';
import { planReminders } from './reminders';

/** يعيد جدولة التذكيرات تلقائياً كلما تغيّر الجدول أو المهام أو الإعدادات. */
export function useReminderSync() {
  useEffect(() => {
    if (!remindersSupported) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let running = Promise.resolve();

    const sync = () => {
      const s = useStore.getState();
      running = running
        .then(() =>
          s.settings.remindersEnabled
            ? applyReminders(
                planReminders({
                  courses: s.courses,
                  slots: s.slots,
                  tasks: s.tasks,
                  bookings: s.myBookings,
                  lectureLeadMin: s.settings.lectureLeadMin,
                  now: Date.now(),
                }),
              )
            : cancelAllReminders(),
        )
        .catch(() => {});
    };
    const schedule = () => {
      clearTimeout(timer);
      timer = setTimeout(sync, 800);
    };

    sync();
    const unsub = useStore.subscribe((state, prev) => {
      if (
        state.slots !== prev.slots ||
        state.tasks !== prev.tasks ||
        state.myBookings !== prev.myBookings ||
        state.courses !== prev.courses ||
        state.settings.remindersEnabled !== prev.settings.remindersEnabled ||
        state.settings.lectureLeadMin !== prev.settings.lectureLeadMin
      ) {
        schedule();
      }
    });
    return () => {
      clearTimeout(timer);
      unsub();
    };
  }, []);
}

/** يطلب الإذن ثم يفعّل التذكيرات. يعيد false إذا رفض المستخدم الإذن. */
export async function turnOnReminders(): Promise<boolean> {
  const ok = await requestReminderPermission();
  useStore.getState().updateSettings(ok ? { remindersEnabled: true, remindersPromptDismissed: true } : { remindersEnabled: false });
  return ok;
}
