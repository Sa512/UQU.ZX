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

/** الطالب بعد الحجز: ليصله إشعار إن ألغى الدكتور موعده. */
export async function ensureStudentPush(): Promise<boolean> {
  const token = await getPushToken();
  if (!token) return false;
  try {
    await cloud.registerStudentPush(token);
    return true;
  } catch {
    return false;
  }
}
