import * as LocalAuthentication from 'expo-local-authentication';

/** هل يدعم الجهاز القفل (بصمة وجه أو إصبع مسجّلة، أو رمز الجوال)؟ */
export async function lockAvailable(): Promise<boolean> {
  try {
    const level = await LocalAuthentication.getEnrolledLevelAsync();
    return level !== LocalAuthentication.SecurityLevel.NONE;
  } catch {
    return false;
  }
}

/** يطلب البصمة (أو رمز الجوال احتياطاً) ويعيد true عند النجاح. */
export async function unlock(): Promise<boolean> {
  try {
    const r = await LocalAuthentication.authenticateAsync({ promptMessage: 'افتح مذاكر', cancelLabel: 'إلغاء', fallbackLabel: 'استخدم رمز الجوال' });
    return r.success;
  } catch {
    return false;
  }
}

export { shouldRelock, RELOCK_AFTER_MS } from './lockPolicy';
