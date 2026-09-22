/** نسخة الويب: النسخ الاحتياطي متاح في تطبيق الجوال فقط. */
import type { BackupFile, ParseResult } from './backup';

export const backupSupported = false;
export const shareBackup = async (_file: BackupFile): Promise<{ ok: boolean; message?: string }> => ({ ok: false, message: 'متاح في تطبيق الجوال' });
export const pickBackup = async (): Promise<ParseResult | null> => null;
