/** متى ننسخ تلقائياً، وبصمة البيانات (منطق خالص بلا اعتماد على الجهاز). */
import { bytesToHex, utf8ToBytes } from '@noble/ciphers/utils';
import { sha256 } from '@noble/hashes/sha256';

/** يوم كامل بين النسخ التلقائية. */
export const AUTO_BACKUP_EVERY = 24 * 3_600_000;

/** بصمة البيانات (بلا تاريخ التصدير) لمعرفة هل تغير شيء منذ آخر نسخة. */
export const fingerprint = (plain: string) => bytesToHex(sha256(utf8ToBytes(plain))).slice(0, 32);

/** هل حان وقت نسخة تلقائية؟ (منطق خالص للاختبار) */
export function autoBackupDue(p: { enabled: boolean; signedIn: boolean; hasPassword: boolean; hasData: boolean; last: number | null; lastHash: string; hash: string; now: number }): boolean {
  if (!p.enabled || !p.signedIn || !p.hasPassword || !p.hasData) return false;
  if (p.hash === p.lastHash) return false;
  return !p.last || p.now - p.last >= AUTO_BACKUP_EVERY;
}

