/** نسخة الويب: النسخ الاحتياطي متاح في تطبيق الجوال فقط. */
export const backupSupported = false;
export const secureRandom = (n: number) => crypto.getRandomValues(new Uint8Array(n));
export const shareBackup = async (_text: string): Promise<{ ok: boolean; message?: string }> => ({ ok: false, message: 'متاح في تطبيق الجوال' });
export const pickBackup = async (): Promise<string | null> => null;
