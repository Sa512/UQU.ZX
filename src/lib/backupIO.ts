import * as DocumentPicker from 'expo-document-picker';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { getRandomBytes } from 'expo-crypto';
import { backupFileName } from './backup';

/** بايتات عشوائية آمنة لتشفير النسخة. */
export const secureRandom = (n: number) => getRandomBytes(n);

export const backupSupported = true;

/** يكتب ملف النسخة ويفتح نافذة المشاركة (حفظ في الملفات، Drive، واتساب…). */
export async function shareBackup(text: string): Promise<{ ok: boolean; message?: string }> {
  try {
    const f = new File(Paths.cache, backupFileName());
    if (f.exists) f.delete();
    f.create();
    f.write(text);
    if (!(await Sharing.isAvailableAsync())) return { ok: false, message: 'المشاركة غير متاحة على هذا الجهاز.' };
    await Sharing.shareAsync(f.uri, { mimeType: 'application/json', dialogTitle: 'حفظ نسخة مذاكر الاحتياطية', UTI: 'public.json' });
    return { ok: true };
  } catch {
    return { ok: false, message: 'تعذّر إنشاء النسخة الاحتياطية.' };
  }
}

/** يفتح منتقي الملفات ويعيد نص الملف. null إذا ألغى المستخدم، وخطأ إن تعذّرت القراءة. */
export async function pickBackup(): Promise<string | null> {
  const res = await DocumentPicker.getDocumentAsync({ type: ['application/json', 'text/plain', '*/*'], copyToCacheDirectory: true });
  if (res.canceled || !res.assets?.length) return null;
  return new File(res.assets[0].uri).text();
}
