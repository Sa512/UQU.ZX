/**
 * «وظّفني»: يبحث في الخريطة (OpenStreetMap) عن الشركات حول موقع محدد،
 * ويستخرج من مواقعها بريد التوظيف، ثم يُرسل لها السيرة الذاتية من بريد المستخدم نفسه.
 * لا خادم ولا مفاتيح: Overpass مجاني، وجلب صفحات الشركات يتم من الجوال مباشرة.
 */
import 'react-native-url-polyfill/auto';

export type LatLng = { latitude: number; longitude: number };

export type Company = {
  id: string;
  name: string;
  website?: string;
  /** أفضل بريد توظيف عُثر عليه (الأول) ثم البقية بترتيب الأفضلية. */
  emails: string[];
  category?: string;
  coords: LatLng;
  /** pending: لم يُفحص موقعه بعد، done: انتهى الفحص. */
  status: 'pending' | 'done';
};

const OVERPASS = ['https://overpass-api.de/api/interpreter', 'https://overpass.kumi.systems/api/interpreter'];

const EMAIL_RE = /[A-Z0-9._%+-]+@[A-Z0-9-]+(?:\.[A-Z0-9-]+)*\.[A-Z]{2,}/gi;
const HIRING = /(^|[._-])(hr|cv|jobs?|careers?|people|join)([._-]|\d|$)|recruit|talent|hiring|resume|employ|vacanc|wazaif|tawzeef/i;
const GENERAL = /^(info|contact|hello|admin|office|support|mail|enquir|inquir|sales|marketing|ksa|sa)\b/i;
const JUNK = /(noreply|no-reply|donotreply|example\.|sentry|wixpress|domain\.com|email\.com|yourname|@2x|\.(png|jpe?g|gif|svg|webp|css|js)$)/i;
const LINK_HINT = /(career|jobs?|join|recruit|hiring|vacanc|contact|about|توظيف|وظائف|انضم|تواصل|اتصل)/i;

/** يحوّل الأشكال المموّهة الشائعة (info [at] x [dot] com، &#64;) إلى بريد عادي. */
export function deobfuscate(html: string): string {
  return html
    .replace(/&#0*64;|&#x0*40;|%40/gi, '@')
    .replace(/&#0*46;|&#x0*2e;/gi, '.')
    .replace(/\s*[[(]\s*at\s*[\])]\s*/gi, '@')
    .replace(/\s*[[(]\s*dot\s*[\])]\s*/gi, '.');
}

/** درجة البريد: التوظيف أولاً ثم البريد العام؛ null يعني تجاهله. */
export function scoreEmail(email: string): number | null {
  const e = email.toLowerCase();
  if (JUNK.test(e)) return null;
  const local = e.split('@')[0];
  if (HIRING.test(local)) return 3;
  if (GENERAL.test(local)) return 1;
  return 0;
}

export function rankEmails(emails: Iterable<string>): string[] {
  const seen = new Map<string, number>();
  for (const raw of emails) {
    const e = raw.trim().toLowerCase().replace(/^mailto:/, '').replace(/[.,;]+$/, '');
    const s = scoreEmail(e);
    if (s !== null && !seen.has(e)) seen.set(e, s);
  }
  return [...seen.entries()].sort((a, b) => b[1] - a[1]).map(([e]) => e);
}

export function extractEmails(html: string): string[] {
  return deobfuscate(html).match(EMAIL_RE) ?? [];
}

export function normalizeUrl(url: string): string | null {
  const u = url.trim();
  if (!u) return null;
  const withScheme = /^https?:\/\//i.test(u) ? u : `https://${u}`;
  try {
    return new URL(withScheme).toString();
  } catch {
    return null;
  }
}

/** روابط صفحات التوظيف/التواصل في نفس الموقع (حد أقصى 3). */
export function hintLinks(html: string, base: string): string[] {
  const host = new URL(base).hostname.replace(/^www\./, '');
  const out = new Set<string>();
  const re = /<a\b[^>]*href=["']([^"'#]+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) && out.size < 3) {
    const [, href, text] = m;
    if (!LINK_HINT.test(href) && !LINK_HINT.test(text)) continue;
    try {
      const u = new URL(href, base);
      if (/^https?:$/.test(u.protocol) && u.hostname.replace(/^www\./, '') === host) out.add(u.toString());
    } catch {}
  }
  return [...out];
}

export function overpassQuery(center: LatLng, radiusM: number, limit = 120): string {
  const { latitude: lat, longitude: lon } = center;
  return `[out:json][timeout:25];nwr(around:${Math.round(radiusM)},${lat},${lon})[name][~"^(website|contact:website|url|email|contact:email)$"~"."];out center tags ${limit};`;
}

type OsmElement = { type: string; id: number; lat?: number; lon?: number; center?: { lat: number; lon: number }; tags?: Record<string, string> };

export function parseOverpass(json: { elements?: OsmElement[] }): Company[] {
  const out: Company[] = [];
  const names = new Set<string>();
  for (const el of json.elements ?? []) {
    const t = el.tags ?? {};
    const lat = el.lat ?? el.center?.lat;
    const lon = el.lon ?? el.center?.lon;
    const name = t['name:ar'] || t.name;
    if (!name || lat == null || lon == null || names.has(name)) continue;
    names.add(name);
    const tagEmails = [t.email, t['contact:email']].filter(Boolean).flatMap((s) => s!.split(/[;,\s]+/));
    const website = normalizeUrl(t.website || t['contact:website'] || t.url || '') ?? undefined;
    const emails = rankEmails(tagEmails);
    out.push({
      id: `${el.type}/${el.id}`,
      name,
      website,
      emails,
      category: t.office || t.shop || t.amenity || t.industrial || t.craft || t.healthcare || t.tourism,
      coords: { latitude: lat, longitude: lon },
      status: website ? 'pending' : 'done',
    });
  }
  return out;
}

async function fetchText(url: string, ms: number, init?: RequestInit): Promise<string> {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), ms);
  try {
    const res = await fetch(url, { ...init, signal: ctl.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return (await res.text()).slice(0, 600_000);
  } finally {
    clearTimeout(timer);
  }
}

/** الشركات حول النقطة (مع خادم احتياطي إن تعطل الأول). */
export async function findCompanies(center: LatLng, radiusM: number): Promise<Company[]> {
  const body = `data=${encodeURIComponent(overpassQuery(center, radiusM))}`;
  let lastErr: unknown;
  for (const url of OVERPASS) {
    try {
      const text = await fetchText(url, 30_000, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body });
      return parseOverpass(JSON.parse(text));
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr;
}

/** يفحص الصفحة الرئيسية ثم صفحات التوظيف/التواصل ويعيد البريد مرتباً. */
export async function scrapeEmails(website: string): Promise<string[]> {
  const found: string[] = [];
  const home = await fetchText(website, 8000).catch(() => '');
  if (!home) return [];
  found.push(...extractEmails(home));
  const ranked = rankEmails(found);
  // وجدنا بريد توظيف في الرئيسية: لا داعي لفتح صفحات أخرى
  if (ranked[0] && scoreEmail(ranked[0])! >= 3) return ranked;
  const pages = await Promise.all(hintLinks(home, website).map((u) => fetchText(u, 7000).catch(() => '')));
  for (const p of pages) found.push(...extractEmails(p));
  return rankEmails(found);
}

/** ينفّذ المهام بتوازٍ محدود حتى يبقى الجوال سريعاً. */
export async function pool<T>(items: T[], size: number, work: (item: T) => Promise<void>, signal?: { cancelled: boolean }) {
  let i = 0;
  const run = async () => {
    while (i < items.length && !signal?.cancelled) await work(items[i++]);
  };
  await Promise.all(Array.from({ length: Math.min(size, items.length) }, run));
}

export const DEFAULT_SUBJECT = 'طلب وظيفة - السيرة الذاتية';
export const DEFAULT_BODY = `السلام عليكم ورحمة الله وبركاته،

أتقدم إليكم بطلب الانضمام لفريق عملكم، ومرفق لكم سيرتي الذاتية.
يسعدني التواصل معكم في أي وقت.

شاكر ومقدر لكم،
`;
