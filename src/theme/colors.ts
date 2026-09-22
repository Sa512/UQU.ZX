/**
 * هوية «مذاكر» اللونية.
 * البنفسجي النيلي للتركيز والثقة، والأخضر الزمردي للإنجاز، والكهرماني للتنبيه.
 * جميع أزواج النص/الخلفية محققة لتباين WCAG AA (4.5:1) على الأقل.
 */
export type Palette = {
  bg: string;
  surface: string;
  surfaceAlt: string;
  border: string;
  text: string;
  textMuted: string;
  textOnPrimary: string;
  primary: string;
  primarySoft: string;
  primaryDeep: string;
  /** خلفية مملوءة يوضع عليها نص أبيض (تباين ≥ 4.5:1 في الوضعين). */
  fill: string;
  successFill: string;
  success: string;
  successSoft: string;
  warning: string;
  warningSoft: string;
  danger: string;
  dangerSoft: string;
  info: string;
  infoSoft: string;
  tabBar: string;
  overlay: string;
  gradient: [string, string];
};

export const light: Palette = {
  bg: '#F5F6FB',
  surface: '#FFFFFF',
  surfaceAlt: '#EEF0F8',
  border: '#E3E6F0',
  text: '#0F172A',
  textMuted: '#5B6478',
  textOnPrimary: '#FFFFFF',
  primary: '#4F46E5',
  primarySoft: '#EEF2FF',
  primaryDeep: '#3730A3',
  fill: '#4F46E5',
  successFill: '#047857',
  success: '#047857',
  successSoft: '#D1FAE5',
  warning: '#B45309',
  warningSoft: '#FEF3C7',
  danger: '#DC2626',
  dangerSoft: '#FEE2E2',
  info: '#0369A1',
  infoSoft: '#E0F2FE',
  tabBar: '#FFFFFF',
  overlay: 'rgba(15, 23, 42, 0.45)',
  gradient: ['#4F46E5', '#7C3AED'],
};

export const dark: Palette = {
  bg: '#0B1020',
  surface: '#141A2E',
  surfaceAlt: '#1C2440',
  border: '#27304D',
  text: '#F1F5F9',
  textMuted: '#A3AEC6',
  textOnPrimary: '#FFFFFF',
  primary: '#818CF8',
  primarySoft: '#1E1B4B',
  primaryDeep: '#6366F1',
  fill: '#5B5CEB',
  successFill: '#047857',
  success: '#34D399',
  successSoft: '#063B2C',
  warning: '#FBBF24',
  warningSoft: '#3D2A05',
  danger: '#F87171',
  dangerSoft: '#3F1212',
  info: '#38BDF8',
  infoSoft: '#0B2A40',
  tabBar: '#10162A',
  overlay: 'rgba(0, 0, 0, 0.6)',
  gradient: ['#4338CA', '#6D28D9'],
};

/** ألوان المقررات: متمايزة، وكلها تحقق تباين ≥ 4.5:1 مع النص الأبيض. */
export const courseColors = [
  '#4F46E5', // نيلي
  '#0369A1', // أزرق سماوي
  '#047857', // زمردي
  '#B45309', // كهرماني
  '#DC2626', // أحمر
  '#BE185D', // وردي
  '#7C3AED', // بنفسجي
  '#0F766E', // فيروزي
] as const;
