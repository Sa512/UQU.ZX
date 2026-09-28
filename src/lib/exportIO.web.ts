/** نسخة الويب: الملف يُنزَّل مباشرة من المتصفح (مفيد للوحة المشرف على الكمبيوتر). الصور متاحة في تطبيق الجوال. */
export const fileExportSupported = true;
export async function shareCsv(fileName: string, csv: string): Promise<{ ok: boolean; message?: string }> {
  try {
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
    return { ok: true };
  } catch {
    return { ok: false, message: 'تعذّر تنزيل الملف.' };
  }
}
export const shareImage = async (_uri: string, _title?: string): Promise<{ ok: boolean; message?: string }> => ({ ok: false, message: 'الحفظ متاح في تطبيق الجوال' });
