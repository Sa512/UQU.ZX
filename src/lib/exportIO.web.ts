/** نسخة الويب: تصدير الملفات متاح في تطبيق الجوال. */
export const fileExportSupported = false;
export const shareCsv = async (_fileName: string, _csv: string): Promise<{ ok: boolean; message?: string }> => ({ ok: false, message: 'التصدير متاح في تطبيق الجوال' });
export const shareImage = async (_uri: string): Promise<{ ok: boolean; message?: string }> => ({ ok: false, message: 'الحفظ متاح في تطبيق الجوال' });
