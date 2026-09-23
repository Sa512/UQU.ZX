import { describe, expect, it, jest } from '@jest/globals';

jest.mock('react-native-purchases', () => ({ __esModule: true, default: {} }));

// eslint-disable-next-line import/first
import { freeTrialDays, statusFromInfo } from '../purchases';

const info = (active: Record<string, { productIdentifier: string; expirationDateMillis: number | null; willRenew: boolean }>) =>
  ({ entitlements: { active, all: active } }) as never;

describe('statusFromInfo', () => {
  it('is inactive without the pro entitlement', () => {
    expect(statusFromInfo(info({}))).toEqual({ active: false, until: null, plan: null, willRenew: false });
  });

  it('maps products to plans and keeps expiry/renewal', () => {
    const s = statusFromInfo(info({ pro: { productIdentifier: 'mudhaker_pro_annual', expirationDateMillis: 123, willRenew: true } }));
    expect(s).toEqual({ active: true, until: 123, plan: 'yearly', willRenew: true });
    expect(statusFromInfo(info({ pro: { productIdentifier: 'mudhaker_pro_six_month', expirationDateMillis: 1, willRenew: false } })).plan).toBe('term');
    expect(statusFromInfo(info({ pro: { productIdentifier: 'mudhaker_pro_monthly', expirationDateMillis: 1, willRenew: true } })).plan).toBe('monthly');
  });
});

describe('freeTrialDays', () => {
  const pkg = (product: object) => ({ product }) as never;
  it('reads Apple intro offers', () => {
    expect(freeTrialDays(pkg({ introPrice: { price: 0, periodUnit: 'WEEK', periodNumberOfUnits: 1, cycles: 1 } }))).toBe(7);
    expect(freeTrialDays(pkg({ introPrice: { price: 4.99, periodUnit: 'MONTH', periodNumberOfUnits: 1, cycles: 1 } }))).toBeNull();
  });
  it('reads Google free phases', () => {
    expect(freeTrialDays(pkg({ introPrice: null, defaultOption: { freePhase: { billingPeriod: { unit: 'DAY', value: 3 } } } }))).toBe(3);
    expect(freeTrialDays(pkg({ introPrice: null, defaultOption: null }))).toBeNull();
    expect(freeTrialDays(undefined)).toBeNull();
  });
});
