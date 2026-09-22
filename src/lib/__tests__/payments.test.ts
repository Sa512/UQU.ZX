import { describe, expect, it } from '@jest/globals';
import {
  availableMethods,
  detectBrand,
  expiryValid,
  formatCardNumber,
  formatExpiry,
  luhnValid,
  normalizeSaudiMobile,
  PLANS,
  sandboxGateway,
  SANDBOX_DECLINE_CARD,
  SANDBOX_OTP,
  validateCard,
  vatBreakdown,
} from '../payments';

const VISA = '4111111111111111';
const MADA = '4406470000000007';

describe('card validation', () => {
  it('validates Luhn checksums', () => {
    expect(luhnValid(VISA)).toBe(true);
    expect(luhnValid(MADA)).toBe(true);
    expect(luhnValid('4111 1111 1111 1112')).toBe(false);
    expect(luhnValid('123')).toBe(false);
  });

  it('detects brands and prefers mada over visa for mada BINs', () => {
    expect(detectBrand(MADA)).toBe('mada');
    expect(detectBrand(VISA)).toBe('visa');
    expect(detectBrand('5555555555554444')).toBe('mastercard');
    expect(detectBrand('2221000000000009')).toBe('mastercard');
    expect(detectBrand('378282246310005')).toBe('amex');
    expect(detectBrand('9999')).toBe('unknown');
  });

  it('formats numbers and expiry while typing', () => {
    expect(formatCardNumber('4111111111111111')).toBe('4111 1111 1111 1111');
    expect(formatCardNumber('378282246310005')).toBe('3782 822463 10005');
    expect(formatExpiry('1')).toBe('1');
    expect(formatExpiry('1228')).toBe('12/28');
  });

  it('checks expiry against the current month', () => {
    const now = new Date(2026, 8, 22); // سبتمبر 2026
    expect(expiryValid('09/26', now)).toBe(true);
    expect(expiryValid('08/26', now)).toBe(false);
    expect(expiryValid('13/30', now)).toBe(false);
    expect(expiryValid('1230', now)).toBe(false);
  });

  it('rejects a non-mada card when mada is selected', () => {
    const e = validateCard({ name: 'Test User', number: VISA, expiry: '12/30', cvv: '123' }, 'mada');
    expect(e.number).toBeDefined();
    expect(validateCard({ name: 'Test User', number: MADA, expiry: '12/30', cvv: '123' }, 'mada')).toEqual({});
  });

  it('requires 4-digit CVV for amex', () => {
    expect(validateCard({ name: 'Test User', number: '378282246310005', expiry: '12/30', cvv: '123' }, 'card').cvv).toBeDefined();
  });
});

describe('saudi mobile', () => {
  it('normalizes common formats', () => {
    expect(normalizeSaudiMobile('0551234567')).toBe('0551234567');
    expect(normalizeSaudiMobile('+966 55 123 4567')).toBe('0551234567');
    expect(normalizeSaudiMobile('551234567')).toBe('0551234567');
    expect(normalizeSaudiMobile('0451234567')).toBeNull();
  });
});

describe('pricing', () => {
  it('splits VAT-inclusive prices', () => {
    const r = vatBreakdown(39.99);
    expect(r.base).toBe(34.77);
    expect(r.vat).toBe(5.22);
    expect(r.base + r.vat).toBeCloseTo(39.99);
  });

  it('shows wallets only on their platform', () => {
    expect(availableMethods('ios')).toContain('applepay');
    expect(availableMethods('ios')).not.toContain('googlepay');
    expect(availableMethods('android')).toContain('googlepay');
    expect(availableMethods('web')).toEqual(['mada', 'card', 'stcpay']);
  });
});

describe('sandbox gateway', () => {
  const plan = PLANS[0];
  const card = { name: 'Test User', number: VISA, expiry: '12/30', cvv: '123' };

  it('approves a valid card and returns last4', async () => {
    const r = await sandboxGateway.pay({ plan, method: 'card', card });
    expect(r).toMatchObject({ ok: true, last4: '1111' });
  });

  it('declines the sandbox decline card', async () => {
    const r = await sandboxGateway.pay({ plan, method: 'card', card: { ...card, number: SANDBOX_DECLINE_CARD } });
    expect(r.ok).toBe(false);
  });

  it('requires the right STC Pay OTP', async () => {
    expect((await sandboxGateway.pay({ plan, method: 'stcpay', mobile: '0551234567', otp: '000000' })).ok).toBe(false);
    expect((await sandboxGateway.pay({ plan, method: 'stcpay', mobile: '0551234567', otp: SANDBOX_OTP })).ok).toBe(true);
  });
});
