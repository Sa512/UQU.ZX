import { describe, expect, it } from '@jest/globals';
import { clampFocus, extendTimer, openProgress } from '../focusTimer';

const NOW = 1_000_000;

describe('focus timer', () => {
  it('adds time to a running session and moves the end', () => {
    const s = extendTimer({ status: 'running', endAt: NOW + 300_000, left: 0, extra: 0 }, 10, 25 * 60, NOW);
    expect(s).toEqual({ status: 'running', left: 900, endAt: NOW + 900_000, extra: 600 });
  });

  it('adds time to a paused session without an end time', () => {
    expect(extendTimer({ status: 'paused', endAt: null, left: 120, extra: 300 }, 5, 25 * 60, NOW)).toEqual({ status: 'paused', left: 420, endAt: null, extra: 600 });
  });

  it('removes time but never below one minute', () => {
    expect(extendTimer({ status: 'paused', endAt: null, left: 600, extra: 0 }, -5, 1500, NOW).left).toBe(300);
    expect(extendTimer({ status: 'paused', endAt: null, left: 90, extra: 0 }, -5, 1500, NOW).left).toBe(60);
  });

  it('caps a session at four hours and ignores idle timers', () => {
    const s = extendTimer({ status: 'paused', endAt: null, left: 600, extra: 0 }, 15, 235 * 60, NOW);
    expect(s.extra).toBe(300);
    const idle = { status: 'idle' as const, endAt: null, left: 0, extra: 0 };
    expect(extendTimer(idle, 5, 1500, NOW)).toBe(idle);
  });

  it('clamps custom durations and loops open-mode progress every 25 minutes', () => {
    expect([clampFocus(2), clampFocus(37.4), clampFocus(999)]).toEqual([5, 37, 240]);
    expect(openProgress(0)).toBe(0);
    expect(openProgress(750)).toBeCloseTo(0.5);
    expect(openProgress(1500)).toBe(0);
  });
});
