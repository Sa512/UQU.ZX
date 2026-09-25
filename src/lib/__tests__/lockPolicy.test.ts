import { describe, expect, it } from '@jest/globals';
import { RELOCK_AFTER_MS, shouldRelock } from '../lockPolicy';

describe('app lock policy', () => {
  it('relocks only after 30s in the background and only when enabled', () => {
    expect(shouldRelock(1000, 1000 + RELOCK_AFTER_MS - 1, true)).toBe(false); // تبديل سريع لتطبيق آخر
    expect(shouldRelock(1000, 1000 + RELOCK_AFTER_MS, true)).toBe(true);
    expect(shouldRelock(1000, 1e12, false)).toBe(false);
    expect(shouldRelock(null, 1e12, true)).toBe(false);
  });
});
