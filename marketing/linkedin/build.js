// يولّد شرائح لينكدإن (1080×1350) بالعربية والإنجليزية + ملف PDF للنشر كـ«مستند» (Carousel).
// الاستخدام: SHOTS_DIR=<مجلد اللقطات> node marketing/linkedin/build.js
const fs = require('fs'); const path = require('path');
const { chromium } = require(process.env.PW || 'playwright');
const ROOT = path.resolve(__dirname, '../..');
const SHOTS = process.env.SHOTS_DIR || path.join(__dirname, 'shots');
const b64 = (f) => fs.readFileSync(f).toString('base64');
const font = (w) => `url(data:font/ttf;base64,${b64(`${ROOT}/node_modules/@expo-google-fonts/ibm-plex-sans-arabic/${w}/IBMPlexSansArabic_${w}.ttf`)})`;
const shot = (f) => `data:image/png;base64,${b64(path.join(SHOTS, (f.includes('/') ? f : 'shots/' + f) + '.png'))}`;
const icon = `data:image/png;base64,${b64(`${ROOT}/assets/icon.png`)}`;
const emo = (n) => `<img class="emo" src="data:image/png;base64,${b64(path.join(ROOT, 'marketing/tiktok/emoji', n + '.png'))}">`;
const phone = (f, w = 300, rot = 0) => `<div class="ph" style="width:${w}px;transform:rotate(${rot}deg)"><img src="${shot(f)}"></div>`;
const TOTAL = 8;
const foot = (i) => `<div class="foot"><span class="brand"><img src="${icon}">مذاكر · Mudhaker</span><span style="direction:ltr">${i} / ${TOTAL}</span></div>`;

const slides = [
  // 1 الغلاف
  `<section class="s cover"><div class="top"><img class="logo" src="${icon}"><div><h1>مذاكر</h1><div class="en big">Mudhaker</div></div></div>
   <p class="lead">رفيق الطالب وعضو هيئة التدريس في الجامعات السعودية</p><p class="en">The study companion for Saudi university students &amp; faculty</p>
   <div class="fan">${phone('light-05-schedule', 300, 6)}${phone('light-04-home', 350, 0)}${phone('raw/7-grades', 300, -6)}</div>${foot(1)}</section>`,
  // 2 المشكلة
  `<section class="s dark"><div class="kick">المشكلة · The problem</div><h2>حياة الطالب الجامعي مبعثرة</h2><p class="en">A student's semester is scattered across apps</p>
   <div class="pains">
    <div>${emo('camera_with_flash')}<b>الجدول صورة في الاستديو</b><span class="en">Schedule lives in a screenshot</span></div>
    <div>${emo('speech_balloon')}<b>الواجبات ضايعة في القروبات</b><span class="en">Deadlines lost in group chats</span></div>
    <div>${emo('grimacing_face')}<b>ما يعرف كم غياب باقي له</b><span class="en">No idea how many absences are left</span></div>
    <div>${emo('exploding_head')}<b>كم يحتاج في النهائي؟</b><span class="en">What do I need on the final?</span></div>
   </div>${foot(2)}</section>`,
  // 3 للطالب
  `<section class="s violet"><div class="kick">للطالب · For students</div><h2>كل فصلك في تطبيق واحد</h2><p class="en">One app for the whole semester</p>
   <div class="row">${phone('raw/7-grades', 300)}${phone('abs-course', 300)}</div>
   <ul class="ticks"><li>كم تحتاج في النهائي لكل تقدير <span class="en">Grade targets for the final</span></li><li>عدّاد الحرمان 25% <span class="en">Absence limit tracker</span></li><li>تذكيرات، مؤقت، بطاقات مراجعة <span class="en">Reminders, focus timer, flashcards</span></li><li>معدل من 5 أو 4 <span class="en">GPA on both Saudi scales</span></li></ul>${foot(3)}</section>`,
  // 4 للدكتور
  `<section class="s teal"><div class="kick">لعضو هيئة التدريس · For faculty</div><h2>الشعب والتحضير في جيبك</h2><p class="en">Sections and attendance in your pocket</p>
   <div class="row">${phone('cloud-2-qr-host', 300)}${phone('prof-3-sections', 300)}</div>
   <ul class="ticks"><li>تحضير بـ QR يتجدد كل 15 ثانية <span class="en">Rotating QR check-in</span></li><li>استيراد الطلاب من Excel بلصقة <span class="en">Paste a roster from Excel</span></li><li>رصد الدرجات والمجموعات <span class="en">Gradebook &amp; groups</span></li><li>حجز الساعات المكتبية <span class="en">Office-hours booking</span></li></ul>${foot(4)}</section>`,
  // 5 النمو داخل المنتج
  `<section class="s rose"><div class="kick">النمو داخل المنتج · Built-in growth</div><h2>كل نتيجة تصير دعوة</h2><p class="en">Every result becomes an invite</p>
   <div class="row">${phone('v13-share-need', 300)}${phone('v13-wrapped-persona', 300)}</div>
   <ul class="ticks"><li>بطاقات ستوري للنتائج بشعار التطبيق <span class="en">Branded story cards</span></li><li>«ملخص فصلك» على طريقة Wrapped <span class="en">Semester Wrapped recap</span></li></ul>${foot(5)}</section>`,
  // 6 الجودة
  `<section class="s dark"><div class="kick">الجودة · Engineering</div><h2>مبني بمعايير إنتاج</h2><p class="en">Built to production standards</p>
   <div class="stats">
    <div><b>37</b><span>شاشة</span><em>screens</em></div><div><b>104</b><span>اختبار آلي</span><em>automated tests</em></div>
    <div><b>iOS + Android</b><span>من كود واحد</span><em>one codebase (Expo)</em></div><div><b>RLS</b><span>حماية كل جداول الخادم</span><em>row-level security</em></div>
    <div><b>RTL</b><span>عربي بالكامل</span><em>Arabic-first</em></div><div><b>WCAG AA</b><span>تباين وإتاحة</span><em>accessible contrast</em></div>
   </div>${foot(6)}</section>`,
  // 7 التسويق
  `<section class="s amber"><div class="kick">الوصول للسوق · Go-to-market</div><h2>تيك توك أولاً، ومن الحرم الجامعي</h2><p class="en">TikTok-first, campus-led</p>
   <ul class="ticks big"><li>مقاطع قصيرة بخطّاف «كم تحتاج في النهائي؟» <span class="en">Short videos built on real student questions</span></li><li>موسيقى أصلية مؤلفة لنا بلا حقوق <span class="en">Original, rights-free soundtrack</span></li><li>سفير لكل دفعة وشراكات مع الأندية <span class="en">Class ambassadors &amp; student clubs</span></li><li>الدكتور يُدخل شعبة كاملة بالـ QR <span class="en">One professor onboards a whole section</span></li></ul>${foot(7)}</section>`,
  // 8 الختام
  `<section class="s cover end"><img class="logo xl" src="${icon}"><h1>مذاكر</h1><p class="lead">قريباً على iPhone و Android</p><p class="en">Coming soon to iPhone &amp; Android</p>
   <div class="cta">sa512.github.io/UQU.ZX</div><p class="small">نرحّب بالجامعات والأندية الطلابية والمستثمرين للتواصل<br><span class="en">Universities, student clubs and investors — let's talk</span></p>${foot(8)}</section>`,
];

const css = `@font-face{font-family:P;font-weight:400;src:${font('400Regular')}}@font-face{font-family:P;font-weight:500;src:${font('500Medium')}}@font-face{font-family:P;font-weight:700;src:${font('700Bold')}}
*{margin:0;padding:0;box-sizing:border-box}body{font-family:P;background:#111}
.s{width:1080px;height:1350px;position:relative;overflow:hidden;padding:90px 80px;color:#fff;display:flex;flex-direction:column;page-break-after:always}
.cover{background:radial-gradient(700px 700px at 90% 5%,rgba(255,255,255,.16),transparent 60%),linear-gradient(160deg,#7C3AED,#4F46E5 55%,#312E81)}
.dark{background:linear-gradient(160deg,#1E1B4B,#0B1020)}.violet{background:linear-gradient(160deg,#6D28D9,#4338CA)}.teal{background:linear-gradient(160deg,#0F766E,#0369A1)}
.rose{background:linear-gradient(160deg,#BE185D,#7C3AED)}.amber{background:linear-gradient(160deg,#C2410C,#9D174D)}
.top{display:flex;align-items:center;gap:36px}.logo{width:170px;height:170px;border-radius:44px;box-shadow:0 20px 50px rgba(0,0,0,.3)}.logo.xl{width:240px;height:240px;border-radius:60px;align-self:center;margin-top:120px}
h1{font-size:150px;line-height:1.05;font-weight:700}.end h1{text-align:center;margin-top:30px}
h2{font-size:76px;line-height:1.25;font-weight:700;margin-top:18px}
.kick{font-size:30px;font-weight:500;opacity:.85}.en{direction:ltr;unicode-bidi:isolate;font-weight:500;opacity:.8;font-size:30px}
.en.big{font-size:54px;opacity:.9}.lead{font-size:50px;font-weight:700;line-height:1.4;margin-top:50px}.cover .en{margin-top:8px}
p.en{margin-top:6px;text-align:right}.end .lead,.end p{text-align:center}.end p.en{text-align:center}
.fan{position:absolute;bottom:-150px;left:0;right:0;display:flex;justify-content:center;align-items:flex-end;gap:28px}
.ph{background:#0F172A;border-radius:44px;padding:10px;box-shadow:0 30px 60px rgba(0,0,0,.35)}.ph img{width:100%;display:block;border-radius:35px}
.row{display:flex;justify-content:center;gap:40px;margin-top:40px;height:560px;overflow:hidden}
.ticks{list-style:none;margin-top:36px;display:flex;flex-direction:column;gap:18px}.ticks li{font-size:36px;font-weight:700;line-height:1.35;padding-right:56px;position:relative}
.ticks li::before{content:'✓';position:absolute;right:0;top:2px;width:40px;height:40px;border-radius:12px;background:#FCD34D;color:#1E1B4B;font-size:26px;display:flex;align-items:center;justify-content:center}
.ticks .en{font-size:26px;display:block;text-align:right;margin-top:2px}.ticks.big{margin-top:60px;gap:34px}.ticks.big li{font-size:44px}
.pains{display:grid;grid-template-columns:1fr 1fr;gap:28px;margin-top:70px}.pains div{background:rgba(255,255,255,.07);border-radius:36px;padding:40px 34px;display:flex;flex-direction:column;gap:10px}
.pains b{font-size:40px;line-height:1.35}.pains .en{font-size:26px}.emo{width:110px;height:110px}
.stats{display:grid;grid-template-columns:1fr 1fr;gap:26px;margin-top:70px}.stats div{background:rgba(255,255,255,.07);border-radius:32px;padding:36px}
.stats b{display:block;font-size:66px;line-height:1.1;color:#FCD34D;direction:ltr;text-align:right}.stats span{display:block;font-size:34px;font-weight:700;margin-top:8px}.stats em{font-style:normal;font-size:26px;opacity:.75;direction:ltr;display:block;text-align:right}
.cta{align-self:center;margin-top:60px;background:#FCD34D;color:#1E1B4B;font-size:46px;font-weight:700;padding:22px 56px;border-radius:99px;direction:ltr}
.small{font-size:32px;line-height:1.6;margin-top:50px;opacity:.9}.small .en{font-size:28px}
.foot{position:absolute;left:80px;right:80px;bottom:44px;display:flex;justify-content:space-between;align-items:center;font-size:26px;opacity:.85;direction:rtl}
.brand{display:flex;align-items:center;gap:14px;font-weight:700}.brand img{width:44px;height:44px;border-radius:12px}
.cover .foot{background:rgba(15,23,42,.7);padding:12px 22px;border-radius:20px;left:60px;right:60px;z-index:3}`;

(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROMIUM || undefined });
  const p = await b.newPage({ viewport: { width: 1080, height: 1350 } });
  const out = path.join(__dirname, 'slides'); fs.mkdirSync(out, { recursive: true });
  for (let i = 0; i < slides.length; i++) {
    await p.setContent(`<html dir="rtl"><style>${css}</style><body>${slides[i]}</body></html>`);
    await p.evaluate(() => document.fonts.ready);
    await p.screenshot({ path: path.join(out, `slide-${i + 1}.png`) });
  }
  await p.setContent(`<html dir="rtl"><style>${css}@page{size:1080px 1350px;margin:0}</style><body>${slides.join('')}</body></html>`);
  await p.evaluate(() => document.fonts.ready);
  await p.pdf({ path: path.join(__dirname, 'mudhaker-linkedin-carousel.pdf'), width: '1080px', height: '1350px', printBackground: true, margin: { top: 0, right: 0, bottom: 0, left: 0 } });
  await b.close();
  console.log('ok');
})();
