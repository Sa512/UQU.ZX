/**
 * توليد مواعيد الحجز من نوافذ الساعات المكتبية.
 * كل الحسابات بتوقيت الرياض (UTC+3 طوال العام) مهما كانت منطقة الجهاز،
 * لتطابق تحقق الخادم في book_office_hour.
 */
export const RIYADH_OFFSET_MIN = 180;

export type Window = { weekday: number; start_min: number; end_min: number; location: string };
export type OfficeSlot = { startsAt: string; dayKey: string; weekday: number; minute: number; location: string; taken: boolean };

const pad = (n: number) => String(n).padStart(2, '0');

/** تاريخ الرياض (yyyy-mm-dd) ويوم الأسبوع لتوقيت UTC معيّن. */
export function riyadhDay(ms: number): { key: string; weekday: number; minute: number } {
  const d = new Date(ms + RIYADH_OFFSET_MIN * 60_000);
  return {
    key: `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`,
    weekday: d.getUTCDay(),
    minute: d.getUTCHours() * 60 + d.getUTCMinutes(),
  };
}

/** ISO بتوقيت الرياض الصريح: 2026-10-05T10:15:00+03:00 */
export const riyadhIso = (dayKey: string, minute: number) => `${dayKey}T${pad(Math.floor(minute / 60))}:${pad(minute % 60)}:00+03:00`;

export function generateSlots(windows: Window[], slotMinutes: number, taken: string[], nowMs: number, days = 14): OfficeSlot[] {
  const takenSet = new Set(taken.map((t) => new Date(t).getTime()));
  const out: OfficeSlot[] = [];
  for (let i = 0; i < days; i++) {
    const day = riyadhDay(nowMs + i * 86_400_000);
    for (const w of windows.filter((x) => x.weekday === day.weekday)) {
      for (let m = w.start_min; m + slotMinutes <= w.end_min; m += slotMinutes) {
        const iso = riyadhIso(day.key, m);
        const ms = new Date(iso).getTime();
        if (ms <= nowMs) continue;
        out.push({ startsAt: iso, dayKey: day.key, weekday: day.weekday, minute: m, location: w.location, taken: takenSet.has(ms) });
      }
    }
  }
  return out.sort((a, b) => a.startsAt.localeCompare(b.startsAt));
}

// ------- محتوى رموز QR -------
export const bookLink = (code: string) => `mudhaker://book?c=${code}`;
export const checkinLink = (code: string, nonce: string) => `mudhaker://checkin?c=${code}&n=${nonce}`;

/** يقرأ رمز QR أو نصاً ملصوقاً: رابط مذاكر، أو «CODE NONCE»، أو الرمز وحده. */
export function parseQr(raw: string): { kind: 'book' | 'checkin' | 'unknown'; code: string; nonce: string } {
  const v = raw.trim();
  const m = /^mudhaker:\/\/(book|checkin)\?(.*)$/i.exec(v);
  if (m) {
    const params = Object.fromEntries(m[2].split('&').map((kv) => kv.split('=').map(decodeURIComponent)));
    return { kind: m[1].toLowerCase() as 'book' | 'checkin', code: (params.c ?? '').toUpperCase(), nonce: (params.n ?? '').toUpperCase() };
  }
  const parts = v.toUpperCase().split(/[\s·\-_,]+/).filter(Boolean);
  if (parts.length >= 2 && /^[A-Z0-9]{6}$/.test(parts[0]) && /^[A-Z0-9]{8}$/.test(parts[1])) return { kind: 'checkin', code: parts[0], nonce: parts[1] };
  if (parts.length === 1 && /^[A-Z0-9]{6}$/.test(parts[0])) return { kind: 'unknown', code: parts[0], nonce: '' };
  return { kind: 'unknown', code: '', nonce: '' };
}
