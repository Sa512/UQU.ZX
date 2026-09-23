import { describe, expect, it, jest } from '@jest/globals';

jest.mock('expo-store-review', () => ({ hasAction: jest.fn(), requestReview: jest.fn() }));
jest.mock('@react-native-async-storage/async-storage', () => ({ __esModule: true, default: { getItem: jest.fn(async () => null), setItem: jest.fn(async () => {}), removeItem: jest.fn(async () => {}) } }));

// eslint-disable-next-line import/first
import { shouldAskReview } from '../growth';

describe('shouldAskReview', () => {
  const now = 1_000_000_000_000;
  it('waits until the user has real value', () => {
    expect(shouldAskReview({ sessions: 2, doneTasks: 5, lastAsked: null, now })).toBe(false);
    expect(shouldAskReview({ sessions: 5, doneTasks: 2, lastAsked: null, now })).toBe(false);
    expect(shouldAskReview({ sessions: 3, doneTasks: 3, lastAsked: null, now })).toBe(true);
  });
  it('asks at most once every 90 days', () => {
    expect(shouldAskReview({ sessions: 9, doneTasks: 9, lastAsked: now - 10 * 86_400_000, now })).toBe(false);
    expect(shouldAskReview({ sessions: 9, doneTasks: 9, lastAsked: now - 91 * 86_400_000, now })).toBe(true);
  });
});
