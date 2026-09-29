import { describe, expect, it } from '@jest/globals';
import { decryptBackup, encryptBackup, isEncryptedBackup } from '../backupCrypto';

let n = 0;
const rnd = (len: number) => Uint8Array.from({ length: len }, () => (n = (n * 1103515245 + 12345) & 0xff));
const PLAIN = JSON.stringify({ app: 'mudhaker', version: 1, data: { students: [{ name: 'سارة الحربي', uniId: '441001' }] } });

describe('encrypted backups', () => {
  it('round-trips with the right password and hides the content', async () => {
    const f = await encryptBackup(PLAIN, 'كلمة-سر-قوية', rnd, 1000 * 20);
    const text = JSON.stringify(f);
    expect(isEncryptedBackup(text)).toBe(true);
    expect(isEncryptedBackup(PLAIN)).toBe(false);
    expect(text).not.toContain('سارة');
    expect(text).not.toContain('441001');
    await expect(decryptBackup(text, 'كلمة-سر-قوية')).resolves.toBe(PLAIN);
  });

  it('rejects a wrong password, tampering and weak passwords', async () => {
    const f = await encryptBackup(PLAIN, 'password-123', rnd, 20_000);
    await expect(decryptBackup(JSON.stringify(f), 'password-124')).rejects.toThrow('bad_password');
    const flipped = { ...f, encrypted: { ...f.encrypted, ct: (f.encrypted.ct[0] === 'a' ? 'b' : 'a') + f.encrypted.ct.slice(1) } };
    await expect(decryptBackup(JSON.stringify(flipped), 'password-123')).rejects.toThrow('bad_password');
    const hostile = { ...f, encrypted: { ...f.encrypted, iter: 1e9 } };
    await expect(decryptBackup(JSON.stringify(hostile), 'password-123')).rejects.toThrow('bad_file');
    await expect(encryptBackup(PLAIN, 'short', rnd)).rejects.toThrow('weak_password');
  });

  it('uses a fresh salt and IV each time', async () => {
    const a = await encryptBackup(PLAIN, 'password-123', rnd, 10_000);
    const b = await encryptBackup(PLAIN, 'password-123', rnd, 10_000);
    expect(a.encrypted.salt).not.toBe(b.encrypted.salt);
    expect(a.encrypted.ct).not.toBe(b.encrypted.ct);
  });
});
