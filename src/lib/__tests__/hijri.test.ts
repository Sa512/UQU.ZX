import { describe, expect, it } from '@jest/globals';
import { formatHijri } from '../hijri';

describe('formatHijri', () => {
  it('uses the Umm al-Qura calendar', () => {
    // 1 رمضان 1447 هـ = 18 فبراير 2026 (تقويم أم القرى)
    expect(formatHijri(new Date(2026, 1, 18, 12))).toBe('1 رمضان 1447 هـ');
  });
});
