/**
 * النسخة السحابية المشفّرة: البيانات تُشفَّر على الجوال (AES-256-GCM بكلمة مرور المستخدم) ثم تُرفع،
 * فالخادم لا يرى إلا نصاً مشفّراً — ويرفض أي شيء غيره. الاستعادة تنزّل الملف وتفك تشفيره هنا.
 */
import { Platform } from 'react-native';
import { fingerprint } from './backupPolicy';
import { backupDataFrom, buildBackup, parseBackup, type ParseResult } from './backup';
import { decryptBackup, encryptBackup } from './backupCrypto';
import { secureRandom } from './backupIO';
import { cloud, type BackupDevice, type BackupInfo } from './cloud';
import { useStore } from '@/store/useStore';

export { AUTO_BACKUP_EVERY, autoBackupDue, fingerprint } from './backupPolicy';

export function deviceLabel(): BackupDevice {
  if (Platform.OS === 'ios') return (Platform as { isPad?: boolean }).isPad ? 'iPad' : 'iPhone';
  if (Platform.OS === 'android') return 'Android';
  return 'web';
}

/** بصمة البيانات (بلا تاريخ التصدير) لمعرفة هل تغير شيء منذ آخر نسخة. */
export function currentPlain(): string {
  return JSON.stringify(backupDataFrom(useStore.getState()));
}

/** يشفّر بيانات هذا الجهاز ويرفعها (تستبدل النسخة السابقة لهذا الحساب). */
export async function uploadBackup(password: string, now = Date.now()): Promise<BackupInfo> {
  const s = useStore.getState();
  const plain = currentPlain();
  const file = JSON.stringify(buildBackup(backupDataFrom(s), new Date(now)));
  const enc = JSON.stringify(await encryptBackup(file, password, secureRandom));
  const info = await cloud.saveBackup(enc, deviceLabel());
  s.updateSettings({ lastCloudBackupAt: now, lastCloudBackupHash: fingerprint(plain) });
  return info;
}

/** ينزّل النسخة ويفك تشفيرها؛ لا يستبدل شيئاً قبل موافقة المستخدم. */
export async function downloadBackup(password: string): Promise<ParseResult | null> {
  const b = await cloud.getBackup();
  if (!b) return null;
  return parseBackup(await decryptBackup(b.blob, password));
}
