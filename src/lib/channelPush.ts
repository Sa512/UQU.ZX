import { useStore, type Course } from '@/store/useStore';
import { cloud } from './cloud';
import { getPushToken } from './push';

/** يسجّل الجهاز لإشعارات قناة المادة مرة واحدة (بلا أي خطأ ظاهر إن لم تتوفر الإشعارات). */
export async function ensureChannelPush(course: Course): Promise<void> {
  if (!course.channel || course.channel.pushed) return;
  const token = await getPushToken();
  if (!token) return;
  try {
    await cloud.subscribeChannel(course.channel.code, token);
    useStore.getState().markChannelPushed(course.id);
  } catch {
    // نحاول مجدداً في المزامنة القادمة
  }
}

/** يلغي إشعارات القناة لهذا الجهاز قبل مغادرتها. */
export async function dropChannelPush(course: Course): Promise<void> {
  if (!course.channel?.pushed) return;
  const token = await getPushToken();
  if (token) await cloud.unsubscribeChannel(course.channel.code, token).catch(() => {});
}
