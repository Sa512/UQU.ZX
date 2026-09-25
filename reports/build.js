// يولّد reports/mudhaker-review-1.3.0.pdf من review.html ولقطات الشاشة.
// الاستخدام: SHOTS_DIR=<مجلد اللقطات> node reports/build.js
const fs = require('fs'); const path = require('path');
const { chromium } = require(process.env.PW || 'playwright');
const ROOT = path.resolve(__dirname, '..');
const SHOTS = process.env.SHOTS_DIR || path.join(__dirname, 'shots');
const IMGS = { home: 'shots/light-04-home', grades: 'raw/7-grades', absence: 'shots/abs-course', wrapped: 'shots/v13-wrapped-persona',
  sections: 'shots/prof-3-sections', channel: 'shots/v14-channel', qr: 'shots/cloud-2-qr-host', gradebook: 'shots/v12-2-gradebook-totals' };
const font = (w) => fs.readFileSync(`${ROOT}/node_modules/@expo-google-fonts/ibm-plex-sans-arabic/${w}/IBMPlexSansArabic_${w}.ttf`).toString('base64');
(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROMIUM || undefined });
  const conv = await b.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1.5 });
  const img = {};
  for (const [k, rel] of Object.entries(IMGS)) {
    await conv.setContent(`<body style="margin:0"><img src="data:image/png;base64,${fs.readFileSync(path.join(SHOTS, rel + '.png')).toString('base64')}" style="width:390px;display:block"></body>`);
    img[k] = 'data:image/jpeg;base64,' + (await conv.screenshot({ type: 'jpeg', quality: 78, clip: { x: 0, y: 0, width: 390, height: 844 } })).toString('base64');
  }
  const html = fs.readFileSync(path.join(__dirname, 'review.html'), 'utf8')
    .replace('/*FONTS*/', [['400Regular', 400], ['500Medium', 500], ['700Bold', 700]].map(([f, w]) => `@font-face{font-family:Plex;font-weight:${w};src:url(data:font/ttf;base64,${font(f)}) format('truetype')}`).join('\n'))
    .replace(/\{\{icon\}\}/g, 'data:image/png;base64,' + fs.readFileSync(`${ROOT}/assets/icon.png`).toString('base64'))
    .replace(/\{\{img:(\w+)\}\}/g, (_, k) => { if (!img[k]) throw new Error('missing image ' + k); return img[k]; });
  const tmp = path.join(__dirname, '_out.html'); fs.writeFileSync(tmp, html);
  const p = await b.newPage();
  await p.goto('file://' + tmp, { waitUntil: 'load' });
  await p.evaluate(() => document.fonts.ready);
  const over = await p.evaluate(() => [...document.querySelectorAll('.page')].map((e, i) => [i + 1, e.scrollHeight]).filter(([, h]) => h > 1123 + 2));
  console.log('pages', await p.evaluate(() => document.querySelectorAll('.page').length), 'overflowing', JSON.stringify(over));
  await p.pdf({ path: path.join(__dirname, 'mudhaker-review-1.3.0.pdf'), format: 'A4', printBackground: true, margin: { top: 0, right: 0, bottom: 0, left: 0 }, preferCSSPageSize: true });
  if (process.env.PREVIEW) { await p.setViewportSize({ width: 794, height: 1123 }); await p.screenshot({ path: process.env.PREVIEW, fullPage: true }); }
  fs.unlinkSync(tmp);
  await b.close();
})();
