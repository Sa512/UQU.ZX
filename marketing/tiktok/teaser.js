// مقطع تشويقي للحساب (قبل الإطلاق): مشاكل يعرفها كل طالب ← «خلاص» ← الشعار مع الدروب ← لقطات سريعة ← «قريباً».
// التوقيتات مضبوطة على شبكة موسيقى mix.py (120 نبضة/دقيقة): البناء 4.9، الدروب 6.9، الختام 12.9.
// الاستخدام: SHOTS_DIR=<مجلد اللقطات> FFMPEG=ffmpeg node marketing/tiktok/teaser.js
const fs = require('fs'); const path = require('path'); const { spawn } = require('child_process');
const { chromium } = require(process.env.PW || 'playwright');
const ROOT = path.resolve(__dirname, '../..');
const SHOTS = process.env.SHOTS_DIR || path.join(__dirname, 'shots');
const FFMPEG = process.env.FFMPEG || 'ffmpeg';
const FPS = 30; const DURATION = 16; const ID = '00-teaser';

// المشاكل: واحدة مع كل ثانية (نبضتان)
const PAINS = [
  ['📸', 'جدولك صورة في الاستديو'],
  ['💬', 'الواجبات ضايعة في القروب'],
  ['😬', 'ما تدري كم غياب باقي لك'],
  ['🤯', 'وكم تحتاج في الفاينل؟'],
];
// اللقطات مع كل ثانية بعد الدروب
const MONTAGE = [
  ['shots/light-05-schedule', 'جدولك'],
  ['raw/7-grades', 'درجاتك'],
  ['shots/abs-course', 'غيابك'],
  ['shots/v13-share-need', 'شارك نتيجتك'],
  ['shots/cloud-2-qr-host', 'وللدكتور: التحضير بالـ QR'],
];

const font = (w) => `url(data:font/ttf;base64,${fs.readFileSync(`${ROOT}/node_modules/@expo-google-fonts/ibm-plex-sans-arabic/${w}/IBMPlexSansArabic_${w}.ttf`).toString('base64')})`;
const b64 = (f) => fs.readFileSync(f).toString('base64');
const markSvg = fs.readFileSync(path.join(ROOT, 'marketing/brand/logo-mark.svg'), 'utf8').replace(/width="1024" height="1024"/, 'width="100%" height="100%"');

const html = `<!doctype html><html dir="rtl"><head><meta charset="utf-8"><style>
@font-face{font-family:Plex;font-weight:500;src:${font('500Medium')}}@font-face{font-family:Plex;font-weight:700;src:${font('700Bold')}}
*{margin:0;padding:0;box-sizing:border-box}
html,body{width:1080px;height:1920px;overflow:hidden;background:#0B1020}
#stage{position:relative;width:1080px;height:1920px;overflow:hidden;font-family:Plex;color:#fff;background:#0B1020}
.full{position:absolute;inset:0}
.center{display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center}
.q{font-size:110px;font-weight:700}
.pain{padding:0 70px}.pain .e{font-size:170px;line-height:1.2}.pain .t{font-size:84px;font-weight:700;line-height:1.35;margin-top:10px}
.glow{position:absolute;left:50%;top:50%;width:1400px;height:1400px;margin:-700px 0 0 -700px;border-radius:50%;background:radial-gradient(circle,rgba(124,58,237,.9) 0%,rgba(79,70,229,.45) 35%,rgba(11,16,32,0) 70%)}
.k1{font-size:120px;font-weight:700}.k2{font-size:80px;font-weight:700;margin-top:20px;color:#FCD34D}
.flash{background:#fff}
.brand{background:linear-gradient(165deg,#7C3AED 0%,#4F46E5 55%,#312E81 100%)}
.bm{width:420px;height:420px;filter:drop-shadow(0 30px 60px rgba(15,23,42,.45))}
.bn{font-size:220px;font-weight:700;line-height:1.1;margin-top:30px}
.phone{position:absolute;left:50%;top:560px;width:600px;margin-left:-300px;background:#0F172A;border-radius:76px;padding:18px;box-shadow:0 40px 90px rgba(15,23,42,.5)}
.screen{border-radius:60px;overflow:hidden;height:1240px;position:relative;background:#F5F6FB}
.screen img{position:absolute;inset:0;width:100%}
.label{position:absolute;left:0;right:0;top:300px;text-align:center}
.label span{display:inline-block;white-space:nowrap;background:#FCD34D;color:#1E1B4B;font-size:74px;font-weight:700;padding:14px 50px;border-radius:40px;box-shadow:0 20px 50px rgba(30,27,75,.4)}
.o .l1{font-size:190px;font-weight:700;line-height:1.1;margin-top:40px}
.o .l3{margin-top:50px;font-size:58px;font-weight:700;background:rgba(255,255,255,.16);padding:18px 50px;border-radius:99px}
.o .cta{margin-top:30px;font-size:50px;font-weight:700;color:#FCD34D}
</style></head><body><div id="stage">
<div class="full center" id="q"><div class="q">طالب جامعي؟</div></div>
${PAINS.map(([e, t], i) => `<div class="full center pain" id="p${i}"><div class="e">${e}</div><div class="t">${t}</div></div>`).join('')}
<div class="glow" id="glow"></div>
<div class="full center" id="k"><div class="k1" id="k1">خلاص…</div><div class="k2" id="k2">جهّزنا لك شي 👀</div></div>
<div class="full flash" id="flash"></div>
<div class="full brand" id="brand"></div>
<div class="full center" id="logo"><div class="bm" id="bm">${markSvg}</div><div class="bn" id="bn">مذاكر</div></div>
<div class="phone" id="phone"><div class="screen">${MONTAGE.map(([f], i) => `<img id="m${i}" src="data:image/png;base64,${b64(path.join(SHOTS, f + '.png'))}">`).join('')}</div></div>
${MONTAGE.map(([, l], i) => `<div class="label" id="l${i}"><span>${l}</span></div>`).join('')}
<div class="full center brand o" id="out"><div class="bm" id="om">${markSvg}</div><div class="l1" id="o1">مذاكر</div><div class="l3" id="o3">قريباً على iPhone و Android</div><div class="cta" id="o4">تابعنا عشان يوصلك أول</div></div>
</div></body></html>`;

function timeline(n) {
  const $ = (id) => document.getElementById(id);
  const ms = (s) => s * 1000;
  // fill: 'both' يُبقي أول إطار قبل البداية وآخر إطار بعد النهاية
  const A = (id, frames, start, dur, easing = 'cubic-bezier(.2,.8,.2,1)', fill = 'both') => $(id).animate(frames, { delay: ms(start), duration: ms(dur), fill, easing });
  const show = (id, from, to, pop = true) => {
    A(id, pop ? [{ opacity: 0, transform: 'scale(1.25)' }, { opacity: 1, transform: 'scale(1)' }] : [{ opacity: 0 }, { opacity: 1 }], from, 0.18);
    $(id).animate([{ opacity: 1 }, { opacity: 0 }], { delay: ms(to), duration: 80, fill: 'forwards' });
  };
  show('q', 0, 0.9);
  [0, 1, 2, 3].forEach((i) => {
    show(`p${i}`, 0.9 + i, 1.9 + i);
    // هزة خفيفة مع كل مشكلة
    $(`p${i}`).animate([{ translate: '0 0' }, { translate: '-14px 0' }, { translate: '12px 0' }, { translate: '0 0' }], { delay: ms(0.95 + i), duration: 220, fill: 'none' });
  });
  // البناء: توهّج يكبر ونص «خلاص»
  A('glow', [{ opacity: 0, transform: 'scale(.3)' }, { opacity: 1, transform: 'scale(1.2)' }], 4.9, 1.85, 'ease-in');
  A('k1', [{ opacity: 0, transform: 'translateY(40px)' }, { opacity: 1, transform: 'none' }], 4.95, 0.35);
  A('k2', [{ opacity: 0, transform: 'scale(.6)' }, { opacity: 1, transform: 'scale(1)' }], 5.6, 0.4);
  $('k').animate([{ opacity: 1 }, { opacity: 0 }], { delay: ms(6.74), duration: 20, fill: 'forwards' });
  $('glow').animate([{ opacity: 1 }, { opacity: 0 }], { delay: ms(6.74), duration: 20, fill: 'forwards', composite: 'replace' });
  // لحظة الصمت ثم ومضة بيضاء والشعار مع الدروب
  A('flash', [{ opacity: 0 }, { opacity: 1, offset: 0.05 }, { opacity: 0 }], 6.86, 0.45, 'linear');
  A('brand', [{ opacity: 0 }, { opacity: 1 }], 6.9, 0.05, 'linear');
  A('logo', [{ opacity: 0 }, { opacity: 1 }], 6.9, 0.05, 'linear');
  A('bm', [{ transform: 'scale(2.4) rotate(-20deg)' }, { transform: 'scale(.94) rotate(3deg)', offset: 0.75 }, { transform: 'none' }], 6.9, 0.5);
  A('bn', [{ opacity: 0, transform: 'translateY(80px)' }, { opacity: 1, transform: 'none' }], 7.15, 0.4);
  $('logo').animate([{ opacity: 1 }, { opacity: 0 }], { delay: ms(7.85), duration: 100, fill: 'forwards' });
  // المونتاج: لقطة جديدة كل ثانية مع ضربة تكبير
  A('phone', [{ opacity: 0, transform: 'translateY(900px)' }, { opacity: 1, transform: 'none' }], 7.8, 0.35);
  for (let i = 0; i < n; i++) {
    const t = 7.9 + i;
    $(`m${i}`).animate([{ opacity: 0 }, { opacity: 1 }], { delay: ms(t), duration: 60, fill: 'backwards' });
    if (i < n - 1) $(`m${i}`).animate([{ opacity: 1 }, { opacity: 0 }], { delay: ms(t + 1), duration: 60, fill: 'forwards' });
    $(`m${i}`).animate([{ scale: 1.08 }, { scale: 1 }], { delay: ms(t), duration: 300, fill: 'both', easing: 'ease-out' });
    show(`l${i}`, t, i < n - 1 ? t + 1 : 12.85);
  }
  $('phone').animate([{ scale: 1 }, { scale: 1.03 }, { scale: 1 }], { delay: ms(7.9), duration: 500, iterations: n * 2, easing: 'ease-out' });
  // الختام
  A('out', [{ opacity: 0, transform: 'scale(1.08)' }, { opacity: 1, transform: 'none' }], 12.9, 0.4);
  A('om', [{ transform: 'scale(0) rotate(-25deg)' }, { transform: 'scale(1.1) rotate(4deg)', offset: 0.7 }, { transform: 'none' }], 13.0, 0.7);
  ['o1', 'o3', 'o4'].forEach((id, i) => A(id, [{ opacity: 0, transform: 'translateY(50px)' }, { opacity: 1, transform: 'none' }], 13.4 + i * 0.35, 0.45));
  const all = document.getAnimations(); all.forEach((a) => a.pause());
  window.seek = (t) => { for (const a of all) a.currentTime = ms(t); };
}

(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROMIUM || undefined });
  const p = await b.newPage({ viewport: { width: 1080, height: 1920 } });
  await p.setContent(html, { waitUntil: 'load' });
  await p.evaluate(() => document.fonts.ready);
  await p.evaluate(timeline, MONTAGE.length);
  const out = path.join(__dirname, 'silent', ID + '.mp4'); fs.mkdirSync(path.dirname(out), { recursive: true });
  const ff = spawn(FFMPEG, ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(FPS), '-i', '-',
    '-c:v', 'libx264', '-preset', 'medium', '-crf', '19', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', out], { stdio: ['pipe', 'inherit', 'inherit'] });
  for (let f = 0; f < DURATION * FPS; f++) {
    await p.evaluate((t) => window.seek(t), f / FPS);
    const buf = await p.screenshot({ type: 'jpeg', quality: 92 });
    if (!ff.stdin.write(buf)) await new Promise((r) => ff.stdin.once('drain', r));
    if (f === Math.round(7.4 * FPS)) fs.writeFileSync(path.join(__dirname, ID + '-cover.jpg'), buf);
  }
  ff.stdin.end(); await new Promise((r, j) => ff.on('close', (c) => (c ? j(new Error('ffmpeg ' + c)) : r())));
  if (process.env.PROOF) for (const t of [0.5, 1.5, 3.5, 5.2, 6.2, 6.8, 7.3, 8.4, 10.4, 11.5, 12.5, 14.8]) { await p.evaluate((t) => window.seek(t), t); await p.screenshot({ path: `${process.env.PROOF}/${ID}-${t}.jpg`, type: 'jpeg', quality: 60 }); }
  console.log(out);
  await b.close();
})();
