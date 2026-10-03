/**
 * كلمة مرور النسخة السحابية تُحفظ في خزنة الجوال المشفّرة (Keychain / Keystore) لهذا الحساب فقط،
 * حتى تعمل النسخة التلقائية دون سؤال. لا تُرسل لأي خادم، وتُحذف عند تسجيل الخروج أو إيقاف النسخ.
 */
import * as SecureStore from 'expo-secure-store';

const key = (account: string) => `mudhaker-backup-pw.${account.replace(/[^A-Za-z0-9._-]/g, '_')}`;

export const canRememberPassword = true;

export async function rememberPassword(account: string, password: string) {
  await SecureStore.setItemAsync(key(account), password);
}

export async function recallPassword(account: string): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(key(account));
  } catch {
    return null;
  }
}

export async function forgetPassword(account: string) {
  await SecureStore.deleteItemAsync(key(account)).catch(() => {});
}
