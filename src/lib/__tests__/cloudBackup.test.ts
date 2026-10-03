import { beforeEach, describe, expect, it, jest } from '@jest/globals';

// eslint-disable-next-line @typescript-eslint/no-require-imports
jest.mock('@react-native-async-storage/async-storage', () => require('@react-native-async-storage/async-storage/jest/async-storage-mock'));

// eslint-disable-next-line import/first
import { randomBytes } from 'node:crypto';
// eslint-disable-next-line import/first
import { backupDataFrom, buildBackup, parseBackup } from '../backup';
// eslint-disable-next-line import/first
import { CLOUD_BACKUP_RE, decryptBackup, encryptBackup } from '../backupCrypto';
// eslint-disable-next-line import/first
import { AUTO_BACKUP_EVERY, autoBackupDue, fingerprint } from '../backupPolicy';
// eslint-disable-next-line import/first
import { createDemoApi, DEMO_ADMIN, DEMO_CODE } from '../cloud/demoApi';
// eslint-disable-next-line import/first
import { useStore } from '@/store/useStore';

const rnd = (n: number) => new Uint8Array(randomBytes(n));
const t = Date.UTC(2026, 9, 5, 6, 0);

describe('cloud backup content', () => {
  beforeEach(() => useStore.getState().resetAll());

  it('carries data but not device-only settings', () => {
    useStore.getState().updateSettings({ lastAccountId: 'acc-1', appLock: true, cloudBackup: true, lastCloudBackupAt: 5, name: 'ريم' });
    const d = backupDataFrom(useStore.getState());
    expect(d.settings.name).toBe('ريم');
    for (const k of ['lastAccountId', 'appLock', 'cloudBackup', 'lastCloudBackupAt', 'lastCloudBackupHash', 'restorePromptDismissed']) expect(d.settings).not.toHaveProperty(k);
  });

  it('restoring keeps this device account link and lock (no wipe on next sync)', () => {
    const st = useStore.getState();
    st.loadSampleData();
    const file = buildBackup({ ...backupDataFrom(useStore.getState()), settings: { ...backupDataFrom(useStore.getState()).settings, lastAccountId: 'someone-else', appLock: false } as never });
    st.resetAll();
    useStore.getState().updateSettings({ lastAccountId: 'me', appLock: true });
    const r = parseBackup(JSON.stringify(file));
    if (!r.ok) throw new Error(r.message);
    useStore.getState().restoreBackup(r.data);
    const s = useStore.getState();
    expect(s.courses.length).toBeGreaterThan(0);
    expect(s.settings).toMatchObject({ lastAccountId: 'me', appLock: true, restorePromptDismissed: true, onboarded: true });
  });
});

describe('auto backup policy', () => {
  const base = { enabled: true, signedIn: true, hasPassword: true, hasData: true, last: t - AUTO_BACKUP_EVERY, lastHash: 'a', hash: 'b', now: t };
  it('backs up once a day when data changed', () => {
    expect(autoBackupDue(base)).toBe(true);
    expect(autoBackupDue({ ...base, last: null })).toBe(true);
    expect(autoBackupDue({ ...base, last: t - AUTO_BACKUP_EVERY + 60_000 })).toBe(false);
    expect(autoBackupDue({ ...base, hash: 'a' })).toBe(false);
  });
  it('needs it enabled, an account, a saved password and some data', () => {
    for (const k of ['enabled', 'signedIn', 'hasPassword', 'hasData'] as const) expect(autoBackupDue({ ...base, [k]: false })).toBe(false);
  });
  it('fingerprints content', () => {
    expect(fingerprint('x')).toHaveLength(32);
    expect(fingerprint('x')).not.toBe(fingerprint('y'));
  });
});

describe('server accepts only encrypted backups', () => {
  it('the app output matches the database rule exactly', async () => {
    const enc = JSON.stringify(await encryptBackup('{"app":"mudhaker"}', 'secret-pass', rnd, 10_000));
    expect(CLOUD_BACKUP_RE.test(enc)).toBe(true);
    expect(CLOUD_BACKUP_RE.test(JSON.stringify(buildBackup(backupDataFrom(useStore.getState()))))).toBe(false);
  });

  it('demo server: save, info, download and decrypt per account', async () => {
    const api = createDemoApi(() => t);
    await api.signUp('s441012345@st.uqu.edu.sa', 'secret123');
    await api.verifyEmail('s441012345@st.uqu.edu.sa', DEMO_CODE);
    await api.completeProfile('ريم', 'student', '');
    await expect(api.backupInfo()).resolves.toBeNull();
    await expect(api.saveBackup('{"app":"mudhaker","version":1}', 'iPad')).rejects.toMatchObject({ code: 'bad_backup' });
    const enc = JSON.stringify(await encryptBackup('بياناتي', 'secret-pass', rnd, 10_000));
    expect(await api.saveBackup(enc, 'iPad')).toMatchObject({ device: 'iPad', size: enc.length });
    expect(await api.backupInfo()).toMatchObject({ device: 'iPad' });
    const b = await api.getBackup();
    expect(await decryptBackup(b!.blob, 'secret-pass')).toBe('بياناتي');
    await expect(decryptBackup(b!.blob, 'wrong-pass')).rejects.toThrow('bad_password');
    // حساب آخر لا يرى نسخة غيره
    await api.signOut();
    await api.signUp(DEMO_ADMIN, 'secret123');
    await api.verifyEmail(DEMO_ADMIN, DEMO_CODE);
    await api.completeProfile('المشرف', 'student', '');
    await expect(api.getBackup()).resolves.toBeNull();
    // التقرير الشهري للمشرف يعدّ النسخ
    expect((await api.adminReport('2026-10')).backups).toBe(1);
    await api.deleteBackup();
  });
});

describe('monthly admin report', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { activeRate, monthKey, monthLabel, reportCsv, reportRows } = require('../adminReport') as typeof import('../adminReport');
  const r = { month: '2026-10', new_students: 120, new_professors: 8, total_users: 400, active_users: 250, bookings: 60, cancelled_by_host: 4, cancelled_by_student: 7, checkins: 900, posts: 30, backups: 55, errors: 2, universities: [{ university: '=HYPERLINK("x")', users: 3 }, { university: '', users: 1 }], weeks: [{ week: '2026-09-28', signups: 40 }] };
  it('labels months and rows', () => {
    expect(monthKey(new Date(2026, 0, 15), -1)).toBe('2025-12');
    expect(monthKey(new Date(2026, 9, 3))).toBe('2026-10');
    expect(monthLabel('2026-10')).toBe('أكتوبر 2026');
    expect(reportRows(r)).toHaveLength(11);
    expect(activeRate(r)).toBe(63);
    expect(activeRate({ ...r, total_users: 0 })).toBe(0);
  });
  it('exports a safe Excel file', () => {
    const csv = reportCsv(r);
    expect(csv.startsWith('﻿')).toBe(true);
    expect(csv).toContain('طلاب جدد,120');
    expect(csv).toContain('"\'=HYPERLINK(""x"")",3');
    expect(csv).toContain('غير محددة,1');
    expect(csv).toContain('2026-09-28,40');
  });
});
