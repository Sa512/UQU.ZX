// الاستخدام: node marketing/brand/build.js  (يحتاج playwright)
const fs = require('fs'); const path = require('path');
const { chromium } = require(process.env.PW || 'playwright');
const ROOT = path.resolve(__dirname, '../..');
const OUT = path.join(ROOT, 'marketing/brand');
const svg = fs.readFileSync(path.join(OUT, 'logo-mark.svg'), 'utf8');
const inner = svg.replace(/^[\s\S]*?<\/defs>/, '').replace(/<\/svg>\s*$/, '');
const defs = svg.match(/<defs>[\s\S]*?<\/defs>/)[0];
const font = (w) => `url(data:font/ttf;base64,${fs.readFileSync(`${ROOT}/node_modules/@expo-google-fonts/ibm-plex-sans-arabic/${w}/IBMPlexSansArabic_${w}.ttf`).toString('base64')})`;
const css = `@font-face{font-family:Plex;font-weight:700;src:${font('700Bold')}}@font-face{font-family:Plex;font-weight:500;src:${font('500Medium')}}
*{margin:0;padding:0;box-sizing:border-box}html,body{background:transparent;font-family:Plex}`;
const mark = (size) => `<svg viewBox="0 0 1024 1024" width="${size}" height="${size}">${defs}${inner}</svg>`;
// الأيقونة بدون الخلفية المستديرة: للصورة الشخصية (تيك توك يقصّها دائرة)
const content = inner.replace(/<rect[^>]*\/>/, '');

const jobs = [
  { file: 'tiktok-avatar.png', w: 1080, h: 1080, html: `<svg viewBox="0 0 1024 1024" width="1080" height="1080">${defs}<rect width="1024" height="1024" fill="url(#bg)"/><g transform="translate(512 512) scale(1.08) translate(-512 -490)">${content}</g></svg>` },
  { file: 'logo-horizontal.png', w: 1400, h: 440, html: row('#1E1B4B', '#5B6478') },
  { file: 'logo-horizontal-white.png', w: 1400, h: 440, html: row('#FFFFFF', 'rgba(255,255,255,.8)') },
  { file: 'logo-stacked.png', w: 900, h: 900, html: `<div style="width:900px;height:900px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:30px">${mark(420)}<div style="font-size:150px;font-weight:700;color:#1E1B4B;line-height:1">مذاكر</div></div>` },
  { file: 'logo-stacked-white.png', w: 900, h: 900, html: `<div style="width:900px;height:900px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:30px">${mark(420)}<div style="font-size:150px;font-weight:700;color:#fff;line-height:1">مذاكر</div></div>` },
];
function row(c1, c2) {
  return `<div dir="rtl" style="width:1400px;height:440px;display:flex;align-items:center;justify-content:center;gap:56px">${mark(300)}<div><div style="font-size:190px;font-weight:700;color:${c1};line-height:1.05">مذاكر</div><div style="font-size:50px;font-weight:500;color:${c2};margin-top:14px">رفيقك الجامعي</div></div></div>`;
}

(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROMIUM || undefined });
  const p = await b.newPage();
  for (const j of jobs) {
    await p.setViewportSize({ width: j.w, height: j.h });
    await p.setContent(`<style>${css}</style>${j.html}`);
    await p.evaluate(() => document.fonts.ready);
    await p.screenshot({ path: path.join(OUT, j.file), omitBackground: true });
    console.log(j.file);
  }
  // لوحة الهوية للمعاينة
  const png = (f) => 'data:image/png;base64,' + fs.readFileSync(path.join(OUT, f)).toString('base64');
  const sw = [['#7C3AED', 'بنفسجي'], ['#4F46E5', 'نيلي'], ['#FCD34D', 'ذهبي'], ['#1E1B4B', 'حبر'], ['#F5F6FB', 'خلفية']];
  await p.setViewportSize({ width: 1600, height: 1110 });
  await p.setContent(`<style>${css}body{background:#F5F6FB}</style><div dir="rtl" style="padding:70px;display:grid;grid-template-columns:1fr 1fr;gap:40px">
    <div style="grid-column:1/3;font-size:60px;font-weight:700;color:#1E1B4B">هوية مذاكر</div>
    <div style="background:#fff;border-radius:40px;display:flex;align-items:center;justify-content:center;height:380px"><img src="${png('logo-horizontal.png')}" style="width:640px"></div>
    <div style="background:linear-gradient(160deg,#7C3AED,#4F46E5 55%,#3730A3);border-radius:40px;display:flex;align-items:center;justify-content:center;height:380px"><img src="${png('logo-horizontal-white.png')}" style="width:640px"></div>
    <div style="background:#fff;border-radius:40px;display:flex;align-items:center;justify-content:center;gap:60px;height:420px">
      <img src="${png('tiktok-avatar.png')}" style="width:260px;border-radius:50%;box-shadow:0 20px 50px rgba(79,70,229,.3)">
      <div style="font-size:30px;color:#5B6478;line-height:1.6">صورة الحساب<br><b style="color:#1E1B4B">تيك توك · سناب · X</b></div></div>
    <div style="background:#fff;border-radius:40px;display:flex;align-items:center;justify-content:space-around;height:420px;padding:0 30px">
      ${sw.map(([c, n]) => `<div style="text-align:center"><div style="width:130px;height:130px;border-radius:30px;background:${c};border:2px solid #E3E6F0"></div><div style="font-size:26px;font-weight:700;color:#1E1B4B;margin-top:14px">${n}</div><div style="font-size:22px;color:#5B6478;direction:ltr">${c}</div></div>`).join('')}</div>
  </div>`);
  await p.evaluate(() => document.fonts.ready);
  await p.screenshot({ path: path.join(OUT, 'brand-board.png') });
  await b.close();
})();
