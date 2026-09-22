/**
 * يولّد صفحات الموقع (docs/) لـ GitHub Pages من نفس محتوى التطبيق:
 *   npm run docs
 */
import { copyFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { APP_INFO } from '../src/content/app.ts';
import { legalDocs, type LegalDoc } from '../src/content/legal.ts';

const OUT = new URL('../docs/', import.meta.url);
mkdirSync(OUT, { recursive: true });
copyFileSync(new URL('../assets/icon.png', import.meta.url), new URL('icon.png', OUT));

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const page = (title: string, body: string, description: string) => `<!doctype html>
<html lang="ar" dir="rtl">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
<link rel="icon" href="icon.png">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Arabic:wght@400;500;700&display=swap" rel="stylesheet">
<style>
  :root { --bg:#F5F6FB; --surface:#FFFFFF; --border:#E3E6F0; --text:#0F172A; --muted:#5B6478; --primary:#4F46E5; --soft:#EEF2FF; }
  @media (prefers-color-scheme: dark) { :root { --bg:#0B1020; --surface:#141A2E; --border:#27304D; --text:#F1F5F9; --muted:#A3AEC6; --primary:#818CF8; --soft:#1E1B4B; } }
  * { box-sizing: border-box; }
  body { margin:0; background:var(--bg); color:var(--text); font-family:'IBM Plex Sans Arabic', system-ui, sans-serif; line-height:1.8; }
  a { color:var(--primary); }
  .wrap { max-width:760px; margin:0 auto; padding:24px 16px 56px; }
  header { display:flex; flex-wrap:wrap; align-items:center; gap:8px 12px; margin-bottom:24px; }
  header img { width:44px; height:44px; border-radius:12px; }
  header a { text-decoration:none; color:var(--text); font-weight:700; font-size:20px; }
  nav { margin-inline-start:auto; display:flex; flex-wrap:wrap; gap:6px 14px; font-size:14px; }
  html, body { max-width:100%; overflow-wrap:anywhere; }
  .hero { background:linear-gradient(135deg,#7C3AED,#4F46E5); color:#fff; border-radius:28px; padding:36px 28px; }
  .hero h1 { margin:0 0 8px; font-size:34px; line-height:1.4; }
  .hero p { margin:0; opacity:.92; font-size:17px; }
  .badge { display:inline-block; margin-top:18px; background:rgba(255,255,255,.18); padding:8px 16px; border-radius:999px; font-size:14px; }
  .grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(220px,1fr)); gap:12px; margin:20px 0; }
  .card { background:var(--surface); border:1px solid var(--border); border-radius:20px; padding:18px 20px; }
  .card h2, .card h3 { margin:0 0 6px; font-size:17px; }
  .card p { margin:0 0 6px; color:var(--muted); }
  .doc h1 { font-size:28px; margin:0 0 4px; }
  .doc .intro { color:var(--muted); margin-bottom:16px; }
  .doc .card { margin-bottom:12px; }
  .doc .card p { color:var(--text); }
  footer { margin-top:32px; color:var(--muted); font-size:14px; text-align:center; }
</style>
</head>
<body><div class="wrap">
<header><img src="icon.png" alt=""><a href="index.html">${esc(APP_INFO.name)}</a>
<nav><a href="privacy.html">الخصوصية</a><a href="terms.html">الشروط</a><a href="index.html#support">الدعم</a></nav></header>
${body}
<footer>© ${new Date().getFullYear()} ${esc(APP_INFO.name)} · <a href="mailto:${APP_INFO.supportEmail}">${esc(APP_INFO.supportEmail)}</a></footer>
</div></body></html>
`;

const docPage = (d: LegalDoc) =>
  `<main class="doc"><h1>${esc(d.title)}</h1><p class="intro">${esc(d.intro)}</p>${d.sections
    .map((s) => `<section class="card"><h2>${esc(s.heading)}</h2>${s.paragraphs.map((p) => `<p>${esc(p)}</p>`).join('')}</section>`)
    .join('')}</main>`;

const features: [string, string][] = [
  ['جدولك في مكان واحد', 'محاضرات ومعامل وساعات مكتبية، مع تنبيه عند تعارض المواعيد.'],
  ['مهام واختبارات', 'واجباتك مرتبة حسب الموعد: متأخرة، اليوم، هذا الأسبوع.'],
  ['ذاكر بتركيز', 'مؤقت بومودورو يحسب وقت مذاكرتك لكل مقرر.'],
  ['بطاقات مراجعة ذكية', 'تكرار متباعد يثبّت المعلومة قبل الاختبار.'],
  ['حاسبة المعدل', 'نظام 5 أو 4، وخطّط للوصول لمعدلك المستهدف.'],
  ['تذكيرات', 'قبل المحاضرة وقبل التسليم والاختبار — بدون إنترنت.'],
];

const docs = legalDocs(APP_INFO);
const home = `<main>
<section class="hero"><h1>${esc(APP_INFO.name)} — رفيقك الجامعي</h1>
<p>نظّم جدولك ومهامك، ذاكر بتركيز، واحسب معدلك. للطالب وعضو هيئة التدريس.</p>
<span class="badge">قريباً على App Store وGoogle Play</span></section>
<div class="grid">${features.map(([h, p]) => `<div class="card"><h3>${esc(h)}</h3><p>${esc(p)}</p></div>`).join('')}</div>
<section class="card" id="support"><h2>الدعم والتواصل</h2>
<p>للاستفسارات والمقترحات والمشكلات التقنية:</p>
<p>البريد: <a href="mailto:${APP_INFO.supportEmail}">${esc(APP_INFO.supportEmail)}</a></p>
<p>الجوال: <a href="tel:${APP_INFO.supportPhoneIntl}" dir="ltr">${esc(APP_INFO.supportPhone)}</a></p>
<p>لحذف بياناتك: من داخل التطبيق ← الإعدادات ← حذف جميع البيانات (بياناتك محفوظة على جهازك فقط).</p></section>
</main>`;

writeFileSync(new URL('index.html', OUT), page(`${APP_INFO.name} — رفيقك الجامعي`, home, 'تطبيق مذاكر لتنظيم الدراسة الجامعية'));
writeFileSync(new URL('privacy.html', OUT), page(`${docs.privacy.title} — ${APP_INFO.name}`, docPage(docs.privacy), docs.privacy.intro));
writeFileSync(new URL('terms.html', OUT), page(`${docs.terms.title} — ${APP_INFO.name}`, docPage(docs.terms), docs.terms.intro));
writeFileSync(new URL('.nojekyll', OUT), '');
console.log('docs/ generated');
