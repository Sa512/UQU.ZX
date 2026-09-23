// يولّد marketing/mudhaker-app-guide.pdf من book.html ولقطات الشاشة.
// الاستخدام: SHOTS_DIR=<مجلد اللقطات> node marketing/guide/build.js marketing/mudhaker-app-guide.pdf
const fs = require('fs'); const path = require('path');
const { chromium } = require('playwright'); // npm i -D playwright
const SP = process.env.SHOTS_DIR || path.join(__dirname, 'shots'); // مجلد لقطات الشاشة (raw/ و shots/)
const ROOT = path.resolve(__dirname, '../..');
const OUT = process.argv[2];

const IMGS = {
  home: 'raw/1-home', schedule: 'raw/2-schedule', focus: 'raw/3-focus', tasks: 'raw/4-tasks', study: 'raw/5-study', gpa: 'raw/6-gpa', grades: 'raw/7-grades',
  stats: 'shots/light-12-stats', decks: 'shots/light-11b-deck', absCourse: 'shots/abs-course', absHome: 'shots/abs-home', examPlan: 'shots/v12-6-tasks-plan', examHome: 'shots/v12-5-home-exam',
  sections: 'shots/prof-3-sections', roster: 'shots/prof-4-roster-import', attendance: 'shots/prof-6-attendance', absence: 'shots/prof-7-absence',
  gradebook: 'shots/v12-2-gradebook-totals', groups: 'shots/v12-3-groups', qr: 'shots/cloud-2-qr-host', book: 'shots/cloud-4-book-slots', profBook: 'shots/cloud-7-prof-bookings',
  importSch: 'shots/prof-1-schedule-import', wallpaper: 'shots/prof-8-wallpaper', semester: 'shots/v12-7-semester',
  dHome: 'shots/dark-04-home', dSchedule: 'shots/dark-05-schedule', dFocus: 'shots/dark-06b-focus-running', dGrades: 'shots/v11-dark-3-grades',
  pro: 'shots/light-13-pro', checkout: 'shots/light-14b-checkout-mada', success: 'shots/light-14c-checkout-success', welcome: 'shots/light-01-welcome',
};

const font = (w) => fs.readFileSync(`${ROOT}/node_modules/@expo-google-fonts/ibm-plex-sans-arabic/${w}/IBMPlexSansArabic_${w}.ttf`).toString('base64');
const icon = 'data:image/png;base64,' + fs.readFileSync(`${ROOT}/assets/icon.png`).toString('base64');

(async () => {
  
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  // تحويل الصور إلى JPEG لتصغير حجم الملف مع الحفاظ على الوضوح
  const conv = await b.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  const img = {};
  for (const [k, rel] of Object.entries(IMGS)) {
    await conv.setContent(`<body style="margin:0"><img src="data:image/png;base64,${fs.readFileSync(`${SP}/${rel}.png`).toString('base64')}" style="width:390px;display:block"></body>`, { waitUntil: 'load', timeout: 60000 });
    console.log('img', k);
    const buf = await conv.screenshot({ type: 'jpeg', quality: 80, clip: { x: 0, y: 0, width: 390, height: 844 } });
    img[k] = 'data:image/jpeg;base64,' + buf.toString('base64');
  }
  const html = fs.readFileSync(path.join(__dirname, 'book.html'), 'utf8')
    .replace('/*FONTS*/', ['400Regular:400', '500Medium:500', '700Bold:700'].map((x) => { const [f, w] = x.split(':'); return `@font-face{font-family:Plex;font-weight:${w};src:url(data:font/ttf;base64,${font(f)}) format('truetype')}`; }).join('\n'))
    .replace(/\{\{icon\}\}/g, icon)
    .replace(/\{\{img:(\w+)\}\}/g, (_, k) => { if (!img[k]) throw new Error('missing image ' + k); return img[k]; });
  const page = await b.newPage();
  fs.writeFileSync(path.join(__dirname, '_out.html'), html);
  await page.goto('file://' + path.join(__dirname, '_out.html'), { waitUntil: 'load', timeout: 180000 });
  await page.evaluate(() => document.fonts.ready);
  await page.pdf({ path: OUT, format: 'A4', printBackground: true, margin: { top: 0, right: 0, bottom: 0, left: 0 }, preferCSSPageSize: true });
  if (process.argv[3]) { await page.setViewportSize({ width: 794, height: 1123 }); await page.screenshot({ path: process.argv[3], fullPage: true }); }
  await b.close();
  console.log('PDF ->', OUT);
})();
