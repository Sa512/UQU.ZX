import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';

export const fileExportSupported = true;

/** يحفظ CSV مؤقتاً ويفتح نافذة المشاركة (حفظ في الملفات، إرسال بالبريد، واتساب…). */
export async function shareCsv(fileName: string, csv: string): Promise<{ ok: boolean; message?: string }> {
  try {
    const f = new File(Paths.cache, fileName);
    if (f.exists) f.delete();
    f.create();
    f.write(csv);
    if (!(await Sharing.isAvailableAsync())) return { ok: false, message: 'المشاركة غير متاحة على هذا الجهاز.' };
    await Sharing.shareAsync(f.uri, { mimeType: 'text/csv', dialogTitle: fileName, UTI: 'public.comma-separated-values-text' });
    return { ok: true };
  } catch {
    return { ok: false, message: 'تعذّر إنشاء الملف.' };
  }
}

/** يحفظ صورة (مثل خلفية الجدول) ويفتح نافذة المشاركة لحفظها في الصور. */
export async function shareImage(uri: string): Promise<{ ok: boolean; message?: string }> {
  try {
    if (!(await Sharing.isAvailableAsync())) return { ok: false, message: 'المشاركة غير متاحة على هذا الجهاز.' };
    await Sharing.shareAsync(uri, { mimeType: 'image/png', dialogTitle: 'حفظ الخلفية', UTI: 'public.png' });
    return { ok: true };
  } catch {
    return { ok: false, message: 'تعذّر حفظ الصورة.' };
  }
}
