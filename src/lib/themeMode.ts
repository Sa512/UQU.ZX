/** وضع الليل والنهار: «حسب الوقت» يجعل التطبيق ليلياً من 6 مساءً حتى 6 صباحاً. */
export type ThemePref = 'system' | 'light' | 'dark' | 'time';

export const NIGHT_FROM = 18;
export const NIGHT_TO = 6;

export const isNightHour = (d: Date) => d.getHours() >= NIGHT_FROM || d.getHours() < NIGHT_TO;

export function resolveDark(pref: ThemePref, systemDark: boolean, now: Date): boolean {
  if (pref === 'dark') return true;
  if (pref === 'light') return false;
  if (pref === 'time') return isNightHour(now);
  return systemDark;
}
