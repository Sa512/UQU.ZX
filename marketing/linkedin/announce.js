// إعلان لينكدإن (1080×1350) بالعربية والإنجليزية: جاهزية النسخة الثانية المطورة، والإطلاق الكامل على المتاجر قرابة يناير.
// الاستخدام: SHOTS_DIR=<مجلد اللقطات> node marketing/linkedin/announce.js
const fs = require('fs'); const path = require('path');
const { chromium } = require(process.env.PW || 'playwright');
const ROOT = path.resolve(__dirname, '../..');
const SHOTS = process.env.SHOTS_DIR || path.join(__dirname, 'shots');
const b64 = (f) => fs.readFileSync(f).toString('base64');
const font = (w) => `url(data:font/ttf;base64,${b64(`${ROOT}/node_modules/@expo-google-fonts/ibm-plex-sans-arabic/${w}/IBMPlexSansArabic_${w}.ttf`)})`;
const shot = (f) => `data:image/png;base64,${b64(path.join(SHOTS, f + '.png'))}`;
const icon = `data:image/png;base64,${b64(`${ROOT}/assets/icon.png`)}`;
const emo = (n) => `<img class="emo" src="data:image/png;base64,${b64(path.join(ROOT, 'marketing/tiktok/emoji/apple', n + '.png'))}">`;
const phone = (f, cls) => `<div class="ph ${cls}"><img src="${shot(f)}"></div>`;

const NEW = [
  ['inbox_tray', 'مواعيد Blackboard تلقائياً', 'Blackboard deadlines, auto-synced'],
  ['loudspeaker', 'قناة الشعبة + إشعار فوري', 'Section channel + instant alerts'],
  ['white_check_mark', 'تحضير QR يتجدد كل 15 ثانية', 'Rotating QR attendance'],
  ['closed_lock_with_key', 'قفل ببصمة الوجه وحماية أعلى', 'Face ID lock & hardened security'],
  ['fire', 'بطاقات المشاركة وملخص الفصل', 'Share cards & Semester Wrapped'],
];

const html = `<!doctype html><html dir="rtl"><head><meta charset="utf-8"><style>
@font-face{font-family:P;font-weight:400;src:${font('400Regular')}}@font-face{font-family:P;font-weight:500;src:${font('500Medium')}}@font-face{font-family:P;font-weight:700;src:${font('700Bold')}}
*{margin:0;padding:0;box-sizing:border-box}
body{width:1080px;height:1350px;font-family:P;color:#fff;overflow:hidden;display:flex;flex-direction:column;
  background:radial-gradient(700px 600px at 92% 4%,rgba(255,255,255,.18),transparent 60%),radial-gradient(800px 700px at 0% 100%,rgba(219,39,119,.35),transparent 60%),linear-gradient(160deg,#7C3AED,#4F46E5 55%,#1E1B4B)}
.en{direction:ltr;unicode-bidi:isolate;font-weight:500;opacity:.82}
.top{display:flex;align-items:center;justify-content:space-between;padding:64px 72px 0}
.brand{display:flex;align-items:center;gap:22px}.brand img{width:96px;height:96px;border-radius:26px;box-shadow:0 14px 34px rgba(0,0,0,.3)}
.brand b{display:block;font-size:50px;line-height:1.05}.brand .en{font-size:28px}
.badge{background:#FCD34D;color:#1E1B4B;font-weight:700;font-size:28px;padding:12px 30px;border-radius:99px;text-align:center;line-height:1.25}
.badge span{display:block;font-size:20px;direction:ltr;opacity:.8}
h1{padding:36px 72px 0;font-size:70px;line-height:1.18;text-wrap:balance}
h1 em{font-style:normal;color:#FCD34D}
.h1en{padding:10px 72px 0;font-size:34px}
.mid{position:relative;display:flex;gap:28px;padding:34px 72px 0;height:600px}
.list{flex:1;display:flex;flex-direction:column;gap:14px;z-index:2}
.it{display:flex;align-items:center;gap:16px;background:rgba(255,255,255,.12);border:1.5px solid rgba(255,255,255,.18);border-radius:26px;padding:14px 22px}
.it .emo{width:58px;height:58px;flex:none}.it b{display:block;font-size:27px;line-height:1.3;white-space:nowrap}.it .en{font-size:19px;display:block;white-space:nowrap}
.phones{position:relative;width:420px;flex:none}
.ph{position:absolute;width:250px;background:#0F172A;border-radius:40px;padding:10px;box-shadow:0 30px 60px rgba(0,0,0,.45)}
.ph img{display:block;width:100%;border-radius:31px}
.p1{left:0;top:40px;transform:rotate(-7deg)}.p2{left:150px;top:0;z-index:2;width:270px}
.status{margin:18px 72px 0;display:grid;grid-template-columns:1fr auto 1fr;align-items:center;gap:22px;background:rgba(15,23,42,.45);border-radius:30px;padding:26px 34px}
.st b{display:block;font-size:29px}.st .en{font-size:19px;display:block}
.st .k{font-size:22px;font-weight:700;color:#A7F3D0;display:block;margin-bottom:4px}
.st.soon .k{color:#FCD34D}
.arrow{font-size:46px;opacity:.7}
.foot{margin:auto 72px 38px;display:flex;justify-content:space-between;font-size:24px;opacity:.85}
</style></head><body>
<div class="top">
  <div class="brand"><img src="${icon}"><div><b>مذاكر</b><div class="en">Mudhaker</div></div></div>
  <div class="badge">النسخة الثانية المطوّرة<span>Version 2 · Upgraded</span></div>
</div>
<h1>صدرت النسخة الثانية <em>المطوّرة</em> من مذاكر</h1>
<div class="h1en en">The upgraded second version of Mudhaker is here</div>
<div class="mid">
  <div class="list">${NEW.map(([e, a, b]) => `<div class="it">${emo(e)}<div><b>${a}</b><span class="en">${b}</span></div></div>`).join('')}</div>
  <div class="phones">${phone('shots/light-04-home', 'p1')}${phone('v16/1-calendar-ok', 'p2')}</div>
</div>
<div class="status">
  <div class="st"><span class="k">✓ الآن · Now</span><b>مكتملة ومختبرة</b><span class="en">Built, tested &amp; in preview</span></div>
  <div class="arrow">←</div>
  <div class="st soon"><span class="k">قريباً · Coming</span><b>الإطلاق الكامل: يناير 2027 تقريباً</b><span class="en">Full store launch · ~January 2027</span></div>
</div>
<div class="foot"><span>للطالب وعضو هيئة التدريس في الجامعات السعودية</span><span class="en">For Saudi university students &amp; faculty</span></div>
</body></html>`;

(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROMIUM || undefined });
  const p = await b.newPage({ viewport: { width: 1080, height: 1350 } });
  await p.setContent(html, { waitUntil: 'load' });
  await p.evaluate(() => document.fonts.ready);
  const out = path.join(__dirname, 'announce-v2.png');
  await p.screenshot({ path: out });
  console.log(out, await p.evaluate(() => document.body.scrollHeight));
  await b.close();
})();
