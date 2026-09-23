import { describe, expect, it } from '@jest/globals';
import { toCloudError } from '../cloud/errors';
import { bookLink, checkinLink, generateSlots, parseQr, riyadhDay } from '../officeHours';

describe('riyadhDay', () => {
  it('uses Riyadh time regardless of device timezone', () => {
    // 21:30 UTC يوم السبت = 00:30 الأحد في الرياض
    const r = riyadhDay(Date.UTC(2026, 9, 3, 21, 30));
    expect(r).toEqual({ key: '2026-10-04', weekday: 0, minute: 30 });
  });
});

describe('generateSlots', () => {
  const windows = [{ weekday: 1, start_min: 600, end_min: 660, location: 'مكتب 3' }];
  const now = Date.UTC(2026, 9, 5, 7, 5); // الإثنين 10:05 بتوقيت الرياض
  it('splits windows into future slots and marks taken ones', () => {
    const s = generateSlots(windows, 15, ['2026-10-05T07:30:00Z'], now, 8);
    // اليوم: 10:15 و10:30 و10:45 (10:00 فات) ثم الإثنين القادم 4 مواعيد
    expect(s.map((x) => x.startsAt)).toEqual([
      '2026-10-05T10:15:00+03:00',
      '2026-10-05T10:30:00+03:00',
      '2026-10-05T10:45:00+03:00',
      '2026-10-12T10:00:00+03:00',
      '2026-10-12T10:15:00+03:00',
      '2026-10-12T10:30:00+03:00',
      '2026-10-12T10:45:00+03:00',
    ]);
    expect(s.filter((x) => x.taken).map((x) => x.startsAt)).toEqual(['2026-10-05T10:30:00+03:00']);
  });
  it('drops a partial last slot', () => {
    expect(generateSlots([{ weekday: 1, start_min: 600, end_min: 650, location: '' }], 20, [], now - 3600_000, 1).map((x) => x.minute)).toEqual([600, 620]);
  });
});

describe('QR payloads', () => {
  it('round-trips links', () => {
    expect(parseQr(bookLink('ABC234'))).toEqual({ kind: 'book', code: 'ABC234', nonce: '' });
    expect(parseQr(checkinLink('ABC234', 'XY7K2M9P'))).toEqual({ kind: 'checkin', code: 'ABC234', nonce: 'XY7K2M9P' });
  });
  it('accepts typed codes', () => {
    expect(parseQr('abc234 xy7k2m9p')).toEqual({ kind: 'checkin', code: 'ABC234', nonce: 'XY7K2M9P' });
    expect(parseQr('abc234')).toEqual({ kind: 'unknown', code: 'ABC234', nonce: '' });
    expect(parseQr('hello')).toEqual({ kind: 'unknown', code: '', nonce: '' });
  });
});

describe('cloud errors', () => {
  it('maps server errors to Arabic messages', () => {
    expect(toCloudError({ message: 'P0001: slot_taken' }).message).toContain('سبقك');
    expect(toCloudError(new TypeError('Failed to fetch')).code).toBe('network');
    expect(toCloudError('weird').code).toBe('unknown');
  });
});
