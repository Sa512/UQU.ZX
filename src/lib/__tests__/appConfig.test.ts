import { describe, expect, it } from '@jest/globals';
import { bannerKey, cleanConfig, compareVersions, DEFAULT_CONFIG, featureOff, storeUrl, updateGate } from '../appConfig';
import { createDemoApi, DEMO_ADMIN, DEMO_CODE } from '../cloud/demoApi';

const base = { ...DEFAULT_CONFIG, min_version: '2.0.0', latest_version: '2.2.0' };

describe('remote app config', () => {
  it('compares versions numerically', () => {
    expect(compareVersions('2.10.0', '2.9.0')).toBeGreaterThan(0);
    expect(compareVersions('2.1.0', '2.1.0')).toBe(0);
    expect(compareVersions('1.9.9', '2.0.0')).toBeLessThan(0);
  });

  it('forces an update below the minimum and suggests one below the latest', () => {
    expect(updateGate(base, '1.9.0')).toEqual({ kind: 'update', force: true });
    expect(updateGate(base, '2.1.0')).toEqual({ kind: 'update', force: false });
    expect(updateGate(base, '2.2.0')).toBeNull();
    expect(updateGate(base, '2.3.0')).toBeNull();
    // إعدادات تالفة أو رقم غريب لا تقفل أحداً
    expect(updateGate({ ...base, min_version: 'x' }, '1.0.0')).toBeNull();
    expect(updateGate(base, 'dev')).toBeNull();
  });

  it('pauses features one by one, or all of them in maintenance', () => {
    expect(featureOff(base, 'booking')).toBe(false);
    expect(featureOff({ ...base, disabled_features: ['booking'] }, 'booking')).toBe(true);
    expect(featureOff({ ...base, disabled_features: ['booking'] }, 'backup')).toBe(false);
    expect(featureOff({ ...base, maintenance: true }, 'channels')).toBe(true);
  });

  it('a changed announcement shows again after being dismissed', () => {
    expect(bannerKey(base)).toBe('');
    expect(bannerKey({ ...base, banner: 'أ' })).not.toBe(bannerKey({ ...base, banner: 'ب' }));
    expect(bannerKey({ ...base, banner: 'أ', banner_level: 'warning' })).not.toBe(bannerKey({ ...base, banner: 'أ' }));
  });

  it('validates like the server', () => {
    const { updated_at: _u, ...c } = base;
    expect(() => cleanConfig({ ...c, min_version: '2.3.0' })).toThrow('bad_version');
    expect(() => cleanConfig({ ...c, ios_url: 'https://evil.example' })).toThrow('bad_url');
    expect(cleanConfig({ ...c, banner: '  تحديث \n مهم ', disabled_features: ['backup', 'booking', 'backup', 'payments' as never] })).toMatchObject({
      banner: 'تحديث مهم',
      disabled_features: ['backup', 'booking'],
    });
    expect(storeUrl(base, 'android')).toContain('id=sa.mudhaker.app');
    expect(storeUrl({ ...base, ios_url: 'https://apps.apple.com/sa/app/id1' }, 'ios')).toBe('https://apps.apple.com/sa/app/id1');
  });

  it('demo server: anyone reads, only the admin writes', async () => {
    const api = createDemoApi(() => Date.UTC(2026, 9, 5));
    expect((await api.getAppConfig())?.maintenance).toBe(false);
    await api.signUp('s441012345@st.uqu.edu.sa', 'secret123');
    await api.verifyEmail('s441012345@st.uqu.edu.sa', DEMO_CODE);
    await api.completeProfile('ريم', 'student', '');
    const { updated_at: _u, ...c } = base;
    await expect(api.adminSetAppConfig({ ...c, maintenance: true })).rejects.toMatchObject({ code: 'not_allowed' });
    await api.signOut();
    await api.signUp(DEMO_ADMIN, 'secret123');
    await api.verifyEmail(DEMO_ADMIN, DEMO_CODE);
    await api.completeProfile('المشرف', 'student', '');
    await expect(api.adminSetAppConfig({ ...c, min_version: '9.0.0' })).rejects.toMatchObject({ code: 'bad_version' });
    expect(await api.adminSetAppConfig({ ...c, maintenance: true, disabled_features: ['booking'] })).toMatchObject({ maintenance: true, disabled_features: ['booking'] });
    expect((await api.adminLog())[0].action).toBe('app_config');
    await api.signOut();
    expect((await api.getAppConfig())?.maintenance).toBe(true);
  });
});
