// يولّد مقاطع تيك توك (1080×1920، 30 إطاراً/ث) من لقطات التطبيق.
// الاستخدام: SHOTS_DIR=<مجلد اللقطات> FFMPEG=<مسار ffmpeg> node marketing/tiktok/build.js [رقم المقطع]
const fs = require('fs'); const path = require('path'); const { spawn } = require('child_process');
const { chromium } = require(process.env.PW || 'playwright');
const ROOT = path.resolve(__dirname, '../..');
const SHOTS = process.env.SHOTS_DIR || path.join(__dirname, 'shots');
const FFMPEG = process.env.FFMPEG || 'ffmpeg';
const FPS = 30;

// كل مقطع: خطّاف (أول 3 ثوانٍ)، شاشة من التطبيق مع تكبير على النقطة المهمة، ملصق النتيجة، ثم الختام.
// focus: موضع النقطة المهمة كنسبة من ارتفاع اللقطة.
const VIDEOS = [
  { id: '01-final-grade', shot: 'raw/7-grades', focus: 0.59,
    hook: ['باقي <em>النهائي</em> من 40', 'كم تحتاج عشان تجيب <em>A</em>؟'],
    sticker: 'تحتاج 35.5 من 40', note: 'ويحسبها لك لكل تقدير تلقائياً' },
  { id: '02-absence', shot: 'shots/abs-course', focus: 0.335,
    hook: ['الدكتور قال: <em>الحرمان 25%</em>', 'طيب كم غياب <em>باقي لي</em>؟'],
    sticker: 'باقي لك غياب واحد بس', note: 'يحسب الحرمان لكل مادة ويحذّرك' },
  { id: '03-qr-attendance', shot: 'shots/cloud-2-qr-host', focus: 0.52,
    hook: ['دكتورنا صار يحضّر <em>بـ QR</em>', 'والرمز يتغيّر <em>كل 15 ثانية</em>'],
    sticker: 'ولا أحد يحضّر عن أحد', note: 'الحضور يُسجَّل في الشعبة تلقائياً' },
];
const OUTRO = { line1: 'مذاكر', line2: 'رفيقك الجامعي', line3: 'قريباً على iPhone و Android', cta: 'تابعنا عشان يوصلك أول' };
const DURATION = 16;

const font = (w) => `url(data:font/ttf;base64,${fs.readFileSync(`${ROOT}/node_modules/@expo-google-fonts/ibm-plex-sans-arabic/${w}/IBMPlexSansArabic_${w}.ttf`).toString('base64')})`;
const b64 = (f) => fs.readFileSync(f).toString('base64');
const markSvg = fs.readFileSync(path.join(ROOT, 'marketing/brand/logo-mark.svg'), 'utf8').replace(/width="1024" height="1024"/, 'width="100%" height="100%"');

function page(v) {
  return `<!doctype html><html dir="rtl"><head><meta charset="utf-8"><style>
@font-face{font-family:Plex;font-weight:500;src:${font('500Medium')}}@font-face{font-family:Plex;font-weight:700;src:${font('700Bold')}}
*{margin:0;padding:0;box-sizing:border-box}
html,body{width:1080px;height:1920px;overflow:hidden;background:#312E81}
#stage{width:1080px;height:1920px;overflow:hidden;font-family:Plex;color:#fff;position:relative;
  background:linear-gradient(165deg,#7C3AED 0%,#4F46E5 55%,#312E81 100%)}
.blob{position:absolute;border-radius:50%;filter:blur(10px)}
.b1{width:760px;height:760px;background:rgba(255,255,255,.10);top:-220px;left:-260px}
.b2{width:620px;height:620px;background:rgba(252,211,77,.12);bottom:-180px;right:-200px}
.hook{position:absolute;left:70px;right:70px;top:0;height:1920px;display:flex;flex-direction:column;justify-content:center;align-items:center;text-align:center;transform-origin:50% 22%}
.hook div{white-space:nowrap;font-size:82px;font-weight:700;line-height:1.35;text-shadow:0 8px 30px rgba(30,27,75,.35)}
.hook em{font-style:normal;color:#1E1B4B;background:#FCD34D;border-radius:22px;padding:0 20px;box-decoration-break:clone;-webkit-box-decoration-break:clone}
.phone{position:absolute;left:50%;top:640px;width:560px;margin-left:-280px;background:#0F172A;border-radius:70px;padding:16px;box-shadow:0 40px 90px rgba(15,23,42,.45)}
.screen{border-radius:56px;overflow:hidden;height:1180px;position:relative;background:#F5F6FB}
.screen img{width:100%;display:block}
.ring{position:absolute;left:14px;right:14px;height:96px;border:8px solid #FCD34D;border-radius:36px;box-shadow:0 0 0 12px rgba(252,211,77,.25)}
.sticker{position:absolute;left:50%;top:1450px;transform:translateX(-50%);white-space:nowrap;background:#FCD34D;color:#1E1B4B;font-size:64px;font-weight:700;padding:22px 48px;border-radius:40px;box-shadow:0 24px 50px rgba(30,27,75,.4)}
.note{position:absolute;left:70px;right:70px;top:230px;text-align:center;font-size:56px;font-weight:700;line-height:1.4}
.outro{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;background:linear-gradient(165deg,#7C3AED 0%,#4F46E5 55%,#312E81 100%)}
.outro .m{width:360px;height:360px;filter:drop-shadow(0 30px 60px rgba(15,23,42,.4))}
.outro .l1{font-size:190px;font-weight:700;line-height:1.1;margin-top:40px}
.outro .l2{font-size:60px;font-weight:500;opacity:.9}
.outro .l3{margin-top:60px;font-size:50px;font-weight:700;background:rgba(255,255,255,.16);padding:18px 44px;border-radius:99px}
.outro .cta{margin-top:26px;font-size:46px;font-weight:700;color:#FCD34D}
.wm{position:absolute;top:150px;left:70px;display:flex;align-items:center;gap:18px;font-size:44px;font-weight:700;opacity:.95}
.wm span{width:80px;height:80px;display:block}
</style></head><body><div id="stage">
<div class="blob b1"></div><div class="blob b2"></div>
<div class="wm" id="wm"><span>${markSvg}</span>مذاكر</div>
<div class="hook" id="hook">${v.hook.map((h, i) => `<div id="h${i}">${h}</div>`).join('')}</div>
<div class="phone" id="phone"><div class="screen"><img id="shot" src="data:image/png;base64,${b64(path.join(SHOTS, v.shot + '.png'))}"><div class="ring" id="ring"></div></div></div>
<div class="sticker" id="sticker">${v.sticker}</div>
<div class="note" id="note">${v.note}</div>
<div class="outro" id="outro"><div class="m" id="om">${markSvg}</div><div class="l1" id="o1">${OUTRO.line1}</div><div class="l2" id="o2">${OUTRO.line2}</div><div class="l3" id="o3">${OUTRO.line3}</div><div class="cta" id="o4">${OUTRO.cta}</div></div>
</div></body></html>`;
}

// الخط الزمني بواجهة Web Animations حتى نتحكم بكل إطار بدقة
function timeline(focus) {
  const $ = (id) => document.getElementById(id);
  const ms = (s) => s * 1000;
  const A = (id, frames, start, dur, easing = 'cubic-bezier(.2,.8,.2,1)') =>
    $(id).animate(frames, { delay: ms(start), duration: ms(dur), fill: 'both', easing });
  const pop = [{ opacity: 0, transform: 'translateY(60px) scale(.9)' }, { opacity: 1, transform: 'none' }];
  // موضع الحلقة الصفراء على النقطة المهمة
  const shot = $('shot'); const screenH = 1180; const imgH = shot.getBoundingClientRect().height;
  const fy = focus * imgH; const scroll = Math.max(0, Math.min(imgH - screenH, fy - screenH * 0.45));
  $('ring').style.top = (fy - scroll - 48) + 'px';
  A('h0', pop, 0.15, 0.5); A('h1', pop, 1.0, 0.5);
  A('hook', [{ transform: 'none' }, { transform: 'translateY(-560px) scale(.8)' }], 3.0, 0.7);
  A('wm', [{ opacity: .95 }, { opacity: 0 }], 2.8, 0.3);
  $('hook').animate([{ opacity: 1 }, { opacity: 0 }], { delay: ms(5.6), duration: ms(0.4), fill: 'forwards' });
  A('phone', [{ transform: 'translateY(1400px)' }, { transform: 'none' }], 3.1, 0.9);
  A('shot', [{ transform: 'none' }, { transform: `translateY(${-scroll}px)` }], 4.3, 1.2, 'ease-in-out');
  const cx = 280, cy = 16 + (fy - scroll); // نقطة التكبير داخل الجوال
  $('phone').style.transformOrigin = `${cx}px ${cy}px`;
  A('phone', [{ scale: 1 }, { scale: 1.28 }], 5.7, 0.8, 'ease-in-out');
  A('ring', [{ opacity: 0, transform: 'scale(1.15)' }, { opacity: 1, transform: 'scale(1)' }], 6.3, 0.4);
  A('ring', [{ boxShadow: '0 0 0 12px rgba(252,211,77,.25)' }, { boxShadow: '0 0 0 30px rgba(252,211,77,0)' }], 6.8, 0.9, 'ease-out');
  A('sticker', [{ opacity: 0, transform: 'translateX(-50%) scale(.4) rotate(-8deg)' }, { opacity: 1, transform: 'translateX(-50%) scale(1.08) rotate(-3deg)', offset: .7 }, { opacity: 1, transform: 'translateX(-50%) scale(1) rotate(-3deg)' }], 6.9, 0.6);
  $('sticker').animate([{ opacity: 1 }, { opacity: 0 }], { delay: ms(9.6), duration: ms(0.3), fill: 'forwards' });
  A('note', [{ opacity: 0, transform: 'translateY(40px)' }, { opacity: 1, transform: 'none' }], 9.9, 0.5);
  A('outro', [{ opacity: 0, transform: 'scale(1.1)' }, { opacity: 1, transform: 'none' }], 12.0, 0.6);
  A('om', [{ transform: 'scale(0) rotate(-25deg)' }, { transform: 'scale(1.1) rotate(4deg)', offset: .7 }, { transform: 'none' }], 12.3, 0.8);
  ['o1', 'o2', 'o3', 'o4'].forEach((id, i) => A(id, pop, 12.8 + i * 0.3, 0.5));
  const all = document.getAnimations(); all.forEach((a) => a.pause());
  window.seek = (t) => { for (const a of all) a.currentTime = ms(t); };
}

(async () => {
  const only = process.argv[2];
  const b = await chromium.launch({ executablePath: process.env.CHROMIUM || undefined });
  const p = await b.newPage({ viewport: { width: 1080, height: 1920 } });
  for (const v of VIDEOS.filter((x) => !only || x.id.startsWith(only))) {
    await p.setContent(page(v), { waitUntil: 'load' });
    await p.evaluate(() => document.fonts.ready);
    await p.evaluate(timeline, v.focus);
    const out = path.join(__dirname, 'silent', v.id + '.mp4'); fs.mkdirSync(path.dirname(out), { recursive: true });
    const ff = spawn(FFMPEG, ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(FPS), '-i', '-',
      '-f', 'lavfi', '-i', 'anullsrc=r=44100:cl=stereo', '-shortest',
      '-c:v', 'libx264', '-preset', 'medium', '-crf', '19', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '64k', '-movflags', '+faststart', out], { stdio: ['pipe', 'inherit', 'inherit'] });
    for (let f = 0; f < DURATION * FPS; f++) {
      await p.evaluate((t) => window.seek(t), f / FPS);
      const buf = await p.screenshot({ type: 'jpeg', quality: 92 });
      if (!ff.stdin.write(buf)) await new Promise((r) => ff.stdin.once('drain', r));
      if (f === Math.round(2.2 * FPS)) fs.writeFileSync(path.join(__dirname, v.id + '-cover.jpg'), buf);
    }
    ff.stdin.end(); await new Promise((r, j) => ff.on('close', (c) => (c ? j(new Error('ffmpeg ' + c)) : r())));
    // صور تدقيق من لحظات مهمة
    if (process.env.PROOF) for (const t of [1.5, 5, 7.5, 10.5, 14.5]) { await p.evaluate((t) => window.seek(t), t); await p.screenshot({ path: `${process.env.PROOF}/${v.id}-${t}.jpg`, type: 'jpeg', quality: 70 }); }
    console.log(out);
  }
  await b.close();
})();
