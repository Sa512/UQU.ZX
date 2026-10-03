/**
 * تشفير النسخة الاحتياطية بكلمة مرور (للدكتور خصوصاً: فيها أسماء طلابه ودرجاتهم).
 * AES-256-GCM بمفتاح مشتق بـ PBKDF2-SHA256 (150 ألف تكرار) وملح عشوائي. مكتبات noble (JavaScript خالص ومدققة).
 * بلا كلمة المرور لا يمكن قراءة الملف، ولا نحتفظ بها في أي مكان.
 */
import { gcm } from '@noble/ciphers/aes';
import { bytesToHex, bytesToUtf8, hexToBytes, utf8ToBytes } from '@noble/ciphers/utils';
import { pbkdf2Async } from '@noble/hashes/pbkdf2';
import { sha256 } from '@noble/hashes/sha256';

export const BACKUP_ITERATIONS = 150_000;
export const MIN_BACKUP_PASSWORD = 8;

export type EncryptedBackupFile = {
  app: 'mudhaker';
  encrypted: { v: 1; kdf: 'pbkdf2-sha256'; iter: number; salt: string; iv: string; ct: string };
};

const deriveKey = (password: string, salt: Uint8Array, iter: number) => pbkdf2Async(sha256, utf8ToBytes(password.normalize('NFC')), salt, { c: iter, dkLen: 32 });

export async function encryptBackup(plain: string, password: string, randomBytes: (n: number) => Uint8Array, iter = BACKUP_ITERATIONS): Promise<EncryptedBackupFile> {
  if (password.length < MIN_BACKUP_PASSWORD) throw new Error('weak_password');
  const salt = randomBytes(16);
  const iv = randomBytes(12);
  const key = await deriveKey(password, salt, iter);
  const ct = gcm(key, iv).encrypt(utf8ToBytes(plain));
  return { app: 'mudhaker', encrypted: { v: 1, kdf: 'pbkdf2-sha256', iter, salt: bytesToHex(salt), iv: bytesToHex(iv), ct: bytesToHex(ct) } };
}

/** الشكل الدقيق الذي يقبله الخادم للنسخة السحابية (نفس الشرط في قاعدة البيانات). */
export const CLOUD_BACKUP_RE = /^\{"app":"mudhaker","encrypted":\{"v":1,"kdf":"pbkdf2-sha256","iter":[0-9]{5,7},"salt":"[0-9a-f]{32}","iv":"[0-9a-f]{24}","ct":"[0-9a-f]{34,}"\}\}$/;
export const CLOUD_BACKUP_MAX = 8_000_000;

/** هل النص ملف نسخة مشفّرة؟ (لا يرمي أخطاء) */
export function isEncryptedBackup(text: string): boolean {
  try {
    const f = JSON.parse(text) as Partial<EncryptedBackupFile>;
    return f?.app === 'mudhaker' && f.encrypted?.v === 1 && typeof f.encrypted.ct === 'string';
  } catch {
    return false;
  }
}

/** يفك التشفير ويعيد نص النسخة. كلمة مرور خاطئة أو ملف معدّل = خطأ bad_password. */
export async function decryptBackup(text: string, password: string): Promise<string> {
  const f = JSON.parse(text) as EncryptedBackupFile;
  const e = f.encrypted;
  // حدود معقولة حتى لا يُستخدم ملف معدّل لتعليق الجهاز
  if (e.kdf !== 'pbkdf2-sha256' || !Number.isInteger(e.iter) || e.iter < 10_000 || e.iter > 2_000_000) throw new Error('bad_file');
  try {
    const key = await deriveKey(password, hexToBytes(e.salt), e.iter);
    return bytesToUtf8(gcm(key, hexToBytes(e.iv)).decrypt(hexToBytes(e.ct)));
  } catch {
    throw new Error('bad_password');
  }
}
