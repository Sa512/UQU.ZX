import { describe, expect, it } from '@jest/globals';
import { resolveDark } from '../themeMode';

const at = (h: number, m = 0) => new Date(2026, 8, 28, h, m);

describe('day and night mode', () => {
  it('follows the explicit choice or the phone', () => {
    expect(resolveDark('dark', false, at(12))).toBe(true);
    expect(resolveDark('light', true, at(23))).toBe(false);
    expect(resolveDark('system', true, at(12))).toBe(true);
    expect(resolveDark('system', false, at(23))).toBe(false);
  });

  it('switches by time: night from 6 pm to 6 am', () => {
    expect([at(5, 59), at(6), at(12), at(17, 59), at(18), at(23), at(0)].map((d) => resolveDark('time', false, d))).toEqual([true, false, false, false, true, true, true]);
  });
});
