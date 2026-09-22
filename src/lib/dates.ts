/** أدوات التاريخ والوقت بالعربية. الأسبوع يبدأ الأحد كما في التقويم الجامعي السعودي. */

export const DAY_NAMES = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
export const DAY_SHORT = ['أحد', 'إثنين', 'ثلاثاء', 'أربعاء', 'خميس', 'جمعة', 'سبت'];
export const MONTHS = [
  'يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو',
  'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر',
];

const pad = (n: number) => String(n).padStart(2, '0');

/** yyyy-mm-dd بالتوقيت المحلي (لا نستخدم toISOString حتى لا تنزاح الأيام بسبب UTC). */
export function toDateKey(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function fromDateKey(key: string): Date {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

export function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

/** الفرق بالأيام الكاملة بين يومين (b - a). */
export function diffDays(a: Date, b: Date): number {
  return Math.round((startOfDay(b).getTime() - startOfDay(a).getTime()) / 86_400_000);
}

export function formatDate(d: Date): string {
  return `${DAY_NAMES[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]}`;
}

export function formatShortDate(d: Date): string {
  return `${d.getDate()} ${MONTHS[d.getMonth()]}`;
}

/** دقائق منذ منتصف الليل ← «٨:٣٠ ص» بصيغة ١٢ ساعة. */
export function formatMinutes(total: number): string {
  const h = Math.floor(total / 60) % 24;
  const m = total % 60;
  const suffix = h < 12 ? 'ص' : 'م';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${pad(m)} ${suffix}`;
}

/** مدة بالدقائق ← «ساعتان و١٥ د» مختصرة. */
export function formatDuration(minutes: number): string {
  const m = Math.max(0, Math.round(minutes));
  const h = Math.floor(m / 60);
  const r = m % 60;
  if (h === 0) return `${r} د`;
  if (r === 0) return `${h} س`;
  return `${h} س ${r} د`;
}

export function formatClock(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  return `${pad(Math.floor(s / 60))}:${pad(s % 60)}`;
}

/** وصف نسبي للموعد: «اليوم»، «غداً»، «بعد ٣ أيام»، «متأخر يومين». */
export function relativeDue(dueKey: string, now = new Date()): { label: string; tone: 'danger' | 'warning' | 'info' | 'muted' } {
  const n = diffDays(now, fromDateKey(dueKey));
  if (n < 0) return { label: n === -1 ? 'متأخر يوم' : `متأخر ${-n} أيام`, tone: 'danger' };
  if (n === 0) return { label: 'اليوم', tone: 'danger' };
  if (n === 1) return { label: 'غداً', tone: 'warning' };
  if (n <= 3) return { label: `بعد ${n} أيام`, tone: 'warning' };
  if (n <= 10) return { label: `بعد ${n} أيام`, tone: 'info' };
  return { label: formatShortDate(fromDateKey(dueKey)), tone: 'muted' };
}

export function greeting(now = new Date()): string {
  const h = now.getHours();
  if (h < 5) return 'سهرة موفقة';
  if (h < 12) return 'صباح الخير';
  if (h < 17) return 'مساء النور';
  return 'مساء الخير';
}
