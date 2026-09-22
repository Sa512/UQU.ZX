/**
 * جدولة التذكيرات المحلية على الجهاز (لا تحتاج خادماً).
 * على الويب لا تُدعم الإشعارات المجدولة، فتصبح الدوال بلا أثر.
 */
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import type { Reminder } from './reminders';

export const remindersSupported = Platform.OS === 'ios' || Platform.OS === 'android';
const CHANNEL_ID = 'reminders';

if (remindersSupported) {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
}

async function ensureChannel() {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
    name: 'التذكيرات',
    description: 'تذكير بالمحاضرات ومواعيد التسليم والاختبارات',
    importance: Notifications.AndroidImportance.HIGH,
  });
}

/** يطلب الإذن عند الحاجة ويعيد true إذا سُمح بالإشعارات. */
export async function requestReminderPermission(): Promise<boolean> {
  if (!remindersSupported) return false;
  await ensureChannel();
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  if (!current.canAskAgain) return false;
  const res = await Notifications.requestPermissionsAsync();
  return res.granted;
}

const FOCUS_ID = 'focus-end';

/** يلغي تذكيرات المحاضرات والمهام فقط (ولا يمس تنبيه انتهاء جلسة المذاكرة). */
async function cancelPlannedReminders() {
  const all = await Notifications.getAllScheduledNotificationsAsync();
  await Promise.all(
    all
      .filter((n) => n.identifier !== FOCUS_ID)
      .map((n) => Notifications.cancelScheduledNotificationAsync(n.identifier)),
  );
}

/** يلغي التذكيرات السابقة ويجدول القائمة الجديدة. */
export async function applyReminders(reminders: Reminder[]): Promise<void> {
  if (!remindersSupported) return;
  await cancelPlannedReminders();
  if (!reminders.length) return;
  const perm = await Notifications.getPermissionsAsync();
  if (!perm.granted) return;
  await ensureChannel();
  const channelId = Platform.OS === 'android' ? CHANNEL_ID : undefined;
  for (const r of reminders) {
    await Notifications.scheduleNotificationAsync({
      identifier: r.id,
      content: { title: r.title, body: r.body, sound: true },
      trigger:
        r.trigger.kind === 'weekly'
          ? {
              type: Notifications.SchedulableTriggerInputTypes.WEEKLY,
              weekday: r.trigger.weekday,
              hour: r.trigger.hour,
              minute: r.trigger.minute,
              channelId,
            }
          : { type: Notifications.SchedulableTriggerInputTypes.DATE, date: r.trigger.date, channelId },
    });
  }
}

export async function cancelAllReminders(): Promise<void> {
  if (!remindersSupported) return;
  await cancelPlannedReminders();
}

/** تنبيه عند انتهاء جلسة المذاكرة أو الاستراحة إذا كان التطبيق في الخلفية. */
export async function scheduleFocusEnd(at: number, mode: 'focus' | 'break'): Promise<void> {
  if (!remindersSupported) return;
  const perm = await Notifications.getPermissionsAsync();
  if (!perm.granted) return;
  await ensureChannel();
  await Notifications.scheduleNotificationAsync({
    identifier: FOCUS_ID,
    content: {
      title: mode === 'focus' ? 'انتهت جلسة المذاكرة 🎉' : 'انتهت الاستراحة',
      body: mode === 'focus' ? 'أحسنت! خذ استراحة قصيرة ثم عد للتركيز.' : 'جاهز لجولة تركيز جديدة؟',
      sound: true,
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: at,
      channelId: Platform.OS === 'android' ? CHANNEL_ID : undefined,
    },
  });
}

export async function cancelFocusEnd(): Promise<void> {
  if (!remindersSupported) return;
  await Notifications.cancelScheduledNotificationAsync(FOCUS_ID).catch(() => {});
}

/** تذكير تجريبي بعد ٥ ثوانٍ للتأكد من أن الإشعارات تعمل. */
export async function sendTestReminder(): Promise<boolean> {
  if (!(await requestReminderPermission())) return false;
  await Notifications.scheduleNotificationAsync({
    content: { title: 'مذاكر 📚', body: 'التذكيرات تعمل! سنذكّرك قبل محاضراتك ومواعيدك.', sound: true },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
      seconds: 5,
      channelId: Platform.OS === 'android' ? CHANNEL_ID : undefined,
    },
  });
  return true;
}
