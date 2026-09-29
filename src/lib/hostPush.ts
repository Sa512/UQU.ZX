import { cloud } from './cloud';
import { getPushToken } from './push';

/** يسجّل جهاز الدكتور لإشعار «حجز جديد» (بصمت إن لم تتوفر الإشعارات أو الخادم). */
export async function ensureHostPush(): Promise<boolean> {
  const token = await getPushToken();
  if (!token) return false;
  try {
    await cloud.registerHostPush(token);
    return true;
  } catch {
    return false;
  }
}
