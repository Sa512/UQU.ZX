import * as DocumentPicker from 'expo-document-picker';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { backupFileName, parseBackup, type BackupFile, type ParseResult } from './backup';

export const backupSupported = true;

/** يكتب ملف النسخة ويفتح نافذة المشاركة (حفظ في الملفات، Drive، واتساب…). */
export async function shareBackup(file: BackupFile): Promise<{ ok: boolean; message?: string }> {
  try {
    const f = new File(Paths.cache, backupFileName());
    if (f.exists) f.delete();
    f.create();
    f.write(JSON.stringify(file));
    if (!(await Sharing.isAvailableAsync())) return { ok: false, message: 'المشاركة غير متاحة على هذا الجهاز.' };
    await Sharing.shareAsync(f.uri, { mimeType: 'application/json', dialogTitle: 'حفظ نسخة مذاكر الاحتياطية', UTI: 'public.json' });
    return { ok: true };
  } catch {
    return { ok: false, message: 'تعذّر إنشاء النسخة الاحتياطية.' };
  }
}

/** يفتح منتقي الملفات ويقرأ النسخة. يعيد null إذا ألغى المستخدم. */
export async function pickBackup(): Promise<ParseResult | null> {
  const res = await DocumentPicker.getDocumentAsync({ type: ['application/json', 'text/plain', '*/*'], copyToCacheDirectory: true });
  if (res.canceled || !res.assets?.length) return null;
  try {
    return parseBackup(await new File(res.assets[0].uri).text());
  } catch {
    return { ok: false, message: 'تعذّر قراءة الملف.' };
  }
}
