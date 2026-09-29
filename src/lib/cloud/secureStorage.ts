/**
 * تخزين جلسة الدخول في خزنة الجوال المشفّرة (Keychain / Keystore) بدل AsyncStorage.
 * SecureStore يفضّل قيماً صغيرة، فنقسم الجلسة إلى أجزاء ونحفظ عددها.
 */
import * as SecureStore from 'expo-secure-store';

const CHUNK = 1800;
const key = (k: string) => k.replace(/[^A-Za-z0-9._-]/g, '_');

export const secureStorage = {
  async getItem(k: string): Promise<string | null> {
    const n = Number(await SecureStore.getItemAsync(`${key(k)}.n`));
    if (!n) return null;
    const parts = await Promise.all(Array.from({ length: n }, (_, i) => SecureStore.getItemAsync(`${key(k)}.${i}`)));
    return parts.some((p) => p === null) ? null : parts.join('');
  },
  async setItem(k: string, v: string): Promise<void> {
    await secureStorage.removeItem(k);
    const parts = Array.from({ length: Math.ceil(v.length / CHUNK) }, (_, i) => v.slice(i * CHUNK, (i + 1) * CHUNK));
    await Promise.all(parts.map((p, i) => SecureStore.setItemAsync(`${key(k)}.${i}`, p)));
    await SecureStore.setItemAsync(`${key(k)}.n`, String(parts.length));
  },
  async removeItem(k: string): Promise<void> {
    const n = Number(await SecureStore.getItemAsync(`${key(k)}.n`)) || 0;
    await Promise.all(Array.from({ length: n }, (_, i) => SecureStore.deleteItemAsync(`${key(k)}.${i}`)));
    await SecureStore.deleteItemAsync(`${key(k)}.n`);
  },
};
