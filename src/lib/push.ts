/**
 * إشعارات إعلانات قناة الشعبة (من الخادم). تحتاج مشروع EAS (projectId) ليعمل «عنوان الإشعارات»؛
 * قبل ذلك تبقى الميزة خاملة دون أي خطأ، ويصل الإعلان عند فتح التطبيق كما كان.
 */
import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { requestReminderPermission } from './notifications';

const projectId = (Constants.expoConfig?.extra as { eas?: { projectId?: string } } | undefined)?.eas?.projectId ?? Constants.easConfig?.projectId;
export const pushSupported = (Platform.OS === 'ios' || Platform.OS === 'android') && !!projectId;

let cached: string | null = null;

export async function getPushToken(): Promise<string | null> {
  if (!pushSupported) return null;
  if (cached) return cached;
  try {
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('announcements', { name: 'إعلانات الدكاترة', description: 'إعلانات قنوات الشعب', importance: Notifications.AndroidImportance.HIGH });
    }
    if (!(await requestReminderPermission())) return null;
    cached = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
    return cached;
  } catch {
    return null;
  }
}

/** فتح المادة عند الضغط على إشعار إعلان. يعيد دالة إلغاء الاستماع. */
export function onAnnouncementTap(cb: (code: string) => void): () => void {
  if (Platform.OS === 'web') return () => {};
  const sub = Notifications.addNotificationResponseReceivedListener((r) => {
    const d = r.notification.request.content.data as { type?: string; code?: string } | undefined;
    if (d?.type === 'channel_post' && typeof d.code === 'string') cb(d.code);
  });
  return () => sub.remove();
}
