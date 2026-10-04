/**
 * التحكم الطارئ عن بُعد: هل يُجبر المستخدم على التحديث؟ هل الخادم في صيانة؟ هل ميزة متوقفة؟
 * منطق خالص (يُختبر بلا جهاز)، ونفس قيود الخادم للوضع التجريبي.
 */
import type { AppConfig, AppFeature } from './cloud/types';

export const FEATURES: { key: AppFeature; label: string }[] = [
  { key: 'booking', label: 'حجز الساعات المكتبية' },
  { key: 'checkin', label: 'التحضير بالـ QR' },
  { key: 'channels', label: 'قنوات الشعب' },
  { key: 'backup', label: 'النسخة السحابية' },
];

export const DEFAULT_CONFIG: AppConfig = {
  min_version: '0.0.0',
  latest_version: '0.0.0',
  maintenance: false,
  maintenance_message: '',
  banner: '',
  banner_level: 'info',
  disabled_features: [],
  ios_url: '',
  updated_at: '',
};

const SEMVER = /^\d{1,2}\.\d{1,2}\.\d{1,3}$/;

/** مقارنة رقمية (2.10.0 أحدث من 2.9.0). */
export function compareVersions(a: string, b: string): number {
  const pa = a.split('.').map(Number);
  const pb = b.split('.').map(Number);
  for (let i = 0; i < 3; i++) if ((pa[i] ?? 0) !== (pb[i] ?? 0)) return (pa[i] ?? 0) - (pb[i] ?? 0);
  return 0;
}

export type Gate = { kind: 'update'; force: true } | { kind: 'update'; force: false } | null;

/** إصدار أقدم من الأدنى = تحديث إجباري؛ أقدم من الأحدث = اقتراح. إعدادات تالفة لا تقفل أحداً. */
export function updateGate(c: AppConfig, version: string): Gate {
  if (!SEMVER.test(version) || !SEMVER.test(c.min_version) || !SEMVER.test(c.latest_version)) return null;
  if (compareVersions(version, c.min_version) < 0) return { kind: 'update', force: true };
  if (compareVersions(version, c.latest_version) < 0) return { kind: 'update', force: false };
  return null;
}

/** في الصيانة تتوقف كل الميزات السحابية مؤقتاً، والباقي يعمل على الجهاز. */
export const featureOff = (c: AppConfig, f: AppFeature) => c.maintenance || c.disabled_features.includes(f);

/** بصمة الإعلان: إن تغيّر نصه يظهر من جديد لمن أخفاه. */
export const bannerKey = (c: AppConfig) => (c.banner ? `${c.banner_level}:${c.banner}` : '');

export function storeUrl(c: AppConfig, os: string): string {
  if (os === 'android') return 'https://play.google.com/store/apps/details?id=sa.mudhaker.app';
  return c.ios_url || 'https://apps.apple.com/sa/search?term=%D9%85%D8%B0%D8%A7%D9%83%D8%B1';
}

/** نفس شروط الخادم (للوضع التجريبي ولفحص النموذج قبل الإرسال). يرمي رمز الخطأ. */
export function cleanConfig(c: Omit<AppConfig, 'updated_at'>): Omit<AppConfig, 'updated_at'> {
  const min = c.min_version.trim();
  const latest = c.latest_version.trim();
  if (!SEMVER.test(min) || !SEMVER.test(latest) || compareVersions(min, latest) > 0) throw new Error('bad_version');
  if (c.ios_url && !/^https:\/\/apps\.apple\.com\//.test(c.ios_url.trim())) throw new Error('bad_url');
  const allowed = new Set(FEATURES.map((f) => f.key));
  return {
    min_version: min,
    latest_version: latest,
    maintenance: !!c.maintenance,
    maintenance_message: c.maintenance_message.trim().slice(0, 300),
    banner: c.banner.replace(/\s+/g, ' ').trim().slice(0, 200),
    banner_level: c.banner_level === 'warning' ? 'warning' : 'info',
    disabled_features: [...new Set(c.disabled_features)].filter((f) => allowed.has(f)).sort(),
    ios_url: c.ios_url.trim(),
  };
}
