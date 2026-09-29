import { describe, expect, it, jest } from '@jest/globals';

const mockMem = new Map<string, string>();
jest.mock('expo-secure-store', () => ({
  getItemAsync: async (k: string) => mockMem.get(k) ?? null,
  setItemAsync: async (k: string, v: string) => {
    if (!/^[A-Za-z0-9._-]+$/.test(k)) throw new Error('bad key');
    if (v.length > 2048) throw new Error('too large');
    mockMem.set(k, v);
  },
  deleteItemAsync: async (k: string) => void mockMem.delete(k),
}));

// eslint-disable-next-line import/first
import { secureStorage } from '../cloud/secureStorage';

describe('secure session storage', () => {
  it('splits large sessions into chunks and restores them', async () => {
    const session = JSON.stringify({ access_token: 'x'.repeat(4200), user: { email: 'a@uqu.edu.sa' } });
    await secureStorage.setItem('sb-abc-auth-token', session);
    expect(mockMem.get('sb-abc-auth-token.n')).toBe('3');
    await expect(secureStorage.getItem('sb-abc-auth-token')).resolves.toBe(session);
    // جلسة أقصر لا تترك أجزاء قديمة
    await secureStorage.setItem('sb-abc-auth-token', 'short');
    expect([...mockMem.keys()].filter((k) => k.startsWith('sb-abc'))).toHaveLength(2);
    await expect(secureStorage.getItem('sb-abc-auth-token')).resolves.toBe('short');
    await secureStorage.removeItem('sb-abc-auth-token');
    await expect(secureStorage.getItem('sb-abc-auth-token')).resolves.toBeNull();
    expect(mockMem.size).toBe(0);
  });

  it('sanitizes keys that SecureStore rejects', async () => {
    await secureStorage.setItem('supabase:auth/token', 'v');
    await expect(secureStorage.getItem('supabase:auth/token')).resolves.toBe('v');
  });
});
