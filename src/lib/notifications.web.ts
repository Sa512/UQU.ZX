/** الويب لا يدعم التذكيرات المجدولة: نسخة بلا أثر حتى لا تُحمَّل مكتبة الإشعارات في المتصفح. */
import type { Reminder } from './reminders';

export const remindersSupported = false;
export const requestReminderPermission = async (): Promise<boolean> => false;
export const applyReminders = async (_reminders: Reminder[]): Promise<void> => {};
export const cancelAllReminders = async (): Promise<void> => {};
export const sendTestReminder = async (): Promise<boolean> => false;
export const scheduleFocusEnd = async (_at: number, _mode: 'focus' | 'break'): Promise<void> => {};
export const cancelFocusEnd = async (): Promise<void> => {};
