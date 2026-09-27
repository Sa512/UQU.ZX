// مقطع موشن كامل عن مذاكر (72 ثانية، 1080×1920): سريع ومتزامن مع إيقاع motion_music.py (120 نبضة/دقيقة).
// المشاهد: فوضى الطالب ← «في تطبيق واحد» ← الشعار (دروب 8) ← 13 ميزة للطالب ← «وللدكتور؟» (دروب 40) ← 7 ميزات للدكتور
//        ← جدار الشاشات (ذروة 56) ← الخصوصية (تهدئة 60) ← الختام (دروب 64) ← ثلاث ضربات النهاية (70).
// الاستخدام: SHOTS_DIR=<مجلد اللقطات> FFMPEG=ffmpeg [WORKERS=4] [PROOF=<مجلد>] node marketing/tiktok/motion.js
const fs = require('fs'); const path = require('path'); const { spawn } = require('child_process');
const { chromium } = require(process.env.PW || 'playwright');
const ROOT = path.resolve(__dirname, '../..');
const SHOTS = process.env.SHOTS_DIR || path.join(__dirname, 'shots');
const FFMPEG = process.env.FFMPEG || 'ffmpeg';
const FPS = 30; const DURATION = 72; const ID = 'motion';
const WORKERS = +(process.env.WORKERS || 4);

// فوضى البداية: مشكلة مع كل نصف ثانية
const CHAOS = [
  ['camera_with_flash', 'جدولك صورة بالاستديو'], ['speech_balloon', 'الواجبات ضايعة بالقروب'], ['anxious', 'كم باقي لي غياب؟'],
  ['exploding_head', 'كم أحتاج بالفاينل؟'], ['alarm_clock', 'نسيت التسليم!'], ['clipboard', 'كشف تحضير ورقي'],
  ['card_index_dividers', 'الدرجات في إكسل'], ['loudspeaker', 'وين الإعلان؟'], ['face_with_spiral_eyes', 'متى الاختبار؟'], ['bar_chart', 'معدلي كم؟'],
];
// [لقطة، سطر كبير، سطر مميز، إيموجي، نقطة التكبير (x%، y%، مقدار)، جديد؟]
const STUDENT = [
  ['shots/light-04-home', 'يومك كله', 'بنظرة وحدة', 'house', [50, 30, 1.3]],
  ['shots/light-05-schedule', 'جدولك', 'بدل صورة الاستديو', 'spiral_calendar_pad', [50, 28, 1.4]],
  ['v16/2-tasks', 'واجباتك', 'مرتبة بمواعيدها', 'memo', [50, 45, 1.35]],
  ['v16/1-calendar-ok', 'مواعيد Blackboard', 'تدخل لحالها', 'inbox_tray', [50, 62, 1.5], true],
  ['raw/7-grades', 'كم تحتاج', 'في الفاينل؟', 'dart', [50, 72, 1.55]],
  ['shots/abs-course', 'غيابك', 'قبل الحرمان', 'rotating_light', [50, 34, 1.6]],
  ['shots/light-10b-gpa-filled', 'معدلك', 'من 5 أو من 4', 'bar_chart', [50, 22, 1.6]],
  ['shots/light-06b-focus-running', 'ذاكر', 'بجلسات تركيز', 'stopwatch', [50, 38, 1.35]],
  ['shots/light-11d-study-revealed', 'بطاقات', 'مراجعة ذكية', 'brain', [50, 40, 1.3]],
  ['shots/v12-6-tasks-plan', 'خطة مذاكرة', 'قبل الاختبار', 'books', [50, 35, 1.35]],
  ['v14/7-home-new-announcement', 'إعلان الدكتور', 'يوصلك فوراً', 'loudspeaker', [50, 62, 1.6], true],
  ['shots/v13-share-need', 'شارك نتيجتك', 'ستوري جاهزة', 'fire', [50, 42, 1.3]],
  ['shots/v13-wrapped-persona', 'ملخص فصلك', 'بأرقامك', 'sparkles', [50, 45, 1.3]],
];
const PROF = [
  ['shots/prof-2-schedule-after', 'جدولك', 'من ملف Excel', 'page_facing_up', [50, 30, 1.4]],
  ['shots/prof-5-section-students', 'شعبك وطلابك', 'بمكان واحد', 'busts_in_silhouette', [50, 40, 1.3]],
  ['shots/cloud-2-qr-host', 'تحضير QR', 'يتغيّر كل 15 ثانية', 'white_check_mark', [50, 30, 1.35]],
  ['shots/v12-2-gradebook-totals', 'رصد الدرجات', 'يجمع لحاله', 'abacus', [50, 55, 1.4]],
  ['shots/cloud-4-book-slots', 'ساعاتك المكتبية', 'بحجز مرتّب', 'calendar', [50, 35, 1.35]],
  ['v14/3-channel-published', 'قناة الشعبة', 'إعلانك يوصل للكل', 'mega', [50, 30, 1.4]],
  ['shots/prof-8-wallpaper', 'خلفية جوالك', 'فيها جدولك', 'frame_with_picture', [50, 62, 1.3]],
];
const WALL = ['shots/dark-04-home', 'shots/light-12-stats', 'shots/dark-05-schedule', 'shots/prof-6-attendance', 'shots/dark-10b-gpa-filled', 'shots/v12-3-groups',
  'shots/dark-11c-study', 'shots/cloud-5-booked', 'shots/dark-07-tasks', 'v14/8-course-announcements', 'shots/dark-06b-focus-running', 'shots/v13-share-gpa',
  'shots/v12-7-semester', 'shots/prof-9-wallpaper-office', 'shots/dark-12-stats', 'shots/v11-light-4-grades-targets'];
const TRUST = [['lock', 'بياناتك على جوالك'], ['no_good', 'ولا نطلب كلمة مرور الجامعة'], ['closed_lock_with_key', 'قفل ببصمة الوجه'], ['crescent_moon', 'فاتح وداكن • عربي 100٪']];
const PAL = [['#4F46E5', '#7C3AED'], ['#DB2777', '#831843'], ['#059669', '#064E3B'], ['#EA580C', '#7C2D12'], ['#0284C7', '#1E3A8A'], ['#7C3AED', '#3B0764'],
  ['#E11D48', '#881337'], ['#0D9488', '#134E4A'], ['#CA8A04', '#713F12'], ['#2563EB', '#1E1B4B'], ['#C026D3', '#701A75'], ['#16A34A', '#14532D'], ['#DC2626', '#7F1D1D']];
const ENTER = ['up', 'right', 'zoom', 'left', 'flip'];
const T_STUDENT = 12; const T_PROF = 42; const STEP = 2;

const font = (w) => `url(data:font/ttf;base64,${fs.readFileSync(`${ROOT}/node_modules/@expo-google-fonts/ibm-plex-sans-arabic/${w}/IBMPlexSansArabic_${w}.ttf`).toString('base64')})`;
const b64 = (f) => fs.readFileSync(f).toString('base64');
const EMOJI_SET = process.env.EMOJI || 'apple';
const emo = {}; const emoji = (name, size) => `<img src="${(emo[name] ||= `data:image/png;base64,${b64(path.join(__dirname, 'emoji', EMOJI_SET === 'apple' ? 'apple' : '', name + '.png'))}`)}" style="width:${size}px;height:${size}px">`;
const shot = (f) => `data:image/png;base64,${b64(path.join(SHOTS, f + '.png'))}`;
const markSvg = fs.readFileSync(path.join(ROOT, 'marketing/brand/logo-mark.svg'), 'utf8').replace(/width="1024" height="1024"/, 'width="100%" height="100%"');
const two = (n) => String(n).padStart(2, '0');

const scene = (id, [img, t1, t2, em, , isNew], i, n, pal, t) => `
<div class="scene" id="${id}" data-in="${t}" data-out="${t + STEP + 0.35}">
  <div class="sbg" style="background:radial-gradient(120% 80% at 80% 10%,${pal[0]} 0%,${pal[1]} 70%,#0B1020 100%)"></div>
  <div class="bignum" id="${id}g">${two(i + 1)}</div>
  <div class="num">${two(i + 1)} <span>/ ${two(n)}</span></div>
  <div class="ttl"><div class="t1" id="${id}a">${t1}</div><div class="t2"><div class="hl" id="${id}h"></div><span id="${id}b">${t2}</span></div></div>
  <div class="phoneW" id="${id}p"><div class="phone" id="${id}q"><div class="screen"><img id="${id}i" src="${shot(img)}"></div></div></div>
  <div class="stk" id="${id}e">${emoji(em, 190)}</div>
  ${isNew ? `<div class="new" id="${id}n">جديد</div>` : ''}
</div>`;

const chapter = (id, t, big, em, sub, bg, fg) => `
<div class="scene chap" id="${id}" data-in="${t}" data-out="${t + 2.35}" style="background:${bg};color:${fg}">
  <div class="marq" id="${id}m">${(big + ' • ').repeat(8)}</div><div class="marq m2" id="${id}m2">${(big + ' • ').repeat(8)}</div>
  <div class="full center"><div class="ce" id="${id}e">${emoji(em, 260)}</div><div class="cb" id="${id}b">${big}</div><div class="cs" id="${id}s">${sub}</div></div>
</div>`;

const html = `<!doctype html><html dir="rtl"><head><meta charset="utf-8"><style>
@font-face{font-family:Plex;font-weight:500;src:${font('500Medium')}}@font-face{font-family:Plex;font-weight:700;src:${font('700Bold')}}
*{margin:0;padding:0;box-sizing:border-box}
html,body{width:1080px;height:1920px;overflow:hidden;background:#0B1020}
#stage{position:relative;width:1080px;height:1920px;overflow:hidden;font-family:Plex;color:#fff;background:#0B1020}
.full{position:absolute;inset:0}
.center{display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center}
.blob{position:absolute;border-radius:50%;filter:blur(90px);opacity:.55}
/* البداية */
.hk{font-size:190px;font-weight:700;line-height:1.05}
#hk2{color:#FCD34D}
.chip{position:absolute;display:flex;align-items:center;gap:18px;background:#fff;color:#1E1B4B;font-size:52px;font-weight:700;padding:16px 34px 16px 26px;border-radius:999px;white-space:nowrap;box-shadow:0 24px 60px rgba(0,0,0,.45)}
.chip img{width:84px;height:84px}
.glow{position:absolute;left:50%;top:50%;width:1500px;height:1500px;margin:-750px 0 0 -750px;border-radius:50%;background:radial-gradient(circle,rgba(124,58,237,.95) 0%,rgba(79,70,229,.45) 35%,rgba(11,16,32,0) 70%)}
.k1{font-size:130px;font-weight:700}.k2{font-size:110px;font-weight:700;color:#FCD34D;margin-top:10px;display:flex;align-items:center;gap:20px}
.flash{background:#fff}
.brand{background:linear-gradient(165deg,#7C3AED 0%,#4F46E5 55%,#312E81 100%)}
.bm{width:440px;height:440px;filter:drop-shadow(0 30px 60px rgba(15,23,42,.45))}
.bn{font-size:230px;font-weight:700;line-height:1.1;margin-top:20px}
.tag{font-size:66px;font-weight:700;color:#FCD34D;margin-top:10px}
.ring{position:absolute;left:50%;top:50%;width:600px;height:600px;margin:-600px 0 0 -300px;border:10px solid rgba(255,255,255,.5);border-radius:50%}
/* الفصول */
.chap{overflow:hidden}
.marq{position:absolute;top:170px;right:0;white-space:nowrap;font-size:240px;font-weight:700;opacity:.12;line-height:1}
.marq.m2{top:auto;bottom:150px}
.ce{margin-bottom:10px}.cb{font-size:250px;font-weight:700;line-height:1.1}.cs{font-size:62px;font-weight:700;margin-top:24px;opacity:.85}
/* مشهد الميزة */
.scene{position:absolute;inset:0;overflow:hidden}
.sbg{position:absolute;inset:0}
.bignum{position:absolute;left:-60px;bottom:-140px;font-size:760px;font-weight:700;line-height:1;color:transparent;-webkit-text-stroke:5px rgba(255,255,255,.14);direction:ltr}
.num{position:absolute;top:70px;right:70px;font-size:46px;font-weight:700;direction:ltr;letter-spacing:2px}.num span{opacity:.55}
.ttl{position:absolute;top:150px;left:0;right:0;text-align:center}
.t1{font-size:136px;font-weight:700;line-height:1.15;text-shadow:0 10px 40px rgba(0,0,0,.25)}
.t2{position:relative;display:inline-block;margin-top:14px;padding:6px 44px}
.t2 span{position:relative;font-size:76px;font-weight:700;color:#1E1B4B}
.hl{position:absolute;inset:0;background:#FCD34D;border-radius:26px;transform-origin:right center}
.phoneW{position:absolute;left:50%;top:620px;width:600px;margin-left:-300px}
.phone{background:#0F172A;border-radius:78px;padding:18px;box-shadow:0 50px 110px rgba(0,0,0,.55),0 0 0 3px rgba(255,255,255,.12)}
.screen{border-radius:62px;overflow:hidden;height:1220px;position:relative;background:#F5F6FB}
.screen img{position:absolute;inset:0;width:100%}
.stk{position:absolute;left:100px;top:560px;filter:drop-shadow(0 20px 30px rgba(0,0,0,.4))}
.new{position:absolute;right:120px;top:600px;background:#EF4444;color:#fff;font-size:54px;font-weight:700;padding:10px 38px;border-radius:999px;box-shadow:0 16px 40px rgba(0,0,0,.4)}
/* بناء الدكتور */
/* الجدار */
#wall{background:#0B1020;overflow:hidden}
.wgrid{position:absolute;left:50%;top:50%;width:2300px;height:3600px;margin:-1800px 0 0 -1150px;display:flex;gap:40px;justify-content:center;transform:perspective(2200px) rotateX(28deg) rotateZ(-14deg)}
.wcol{display:flex;flex-direction:column;gap:40px;width:420px}
.wcol img{width:420px;border-radius:40px;box-shadow:0 30px 60px rgba(0,0,0,.6)}
.wshade{background:radial-gradient(60% 45% at 50% 50%,rgba(11,16,32,.2),rgba(11,16,32,.85))}
.wt{font-size:150px;font-weight:700;line-height:1.1;text-shadow:0 12px 50px rgba(0,0,0,.8)}
.wt2{font-size:90px;font-weight:700;color:#FCD34D;text-shadow:0 12px 50px rgba(0,0,0,.8);margin-top:20px}
/* الخصوصية */
#trust{background:radial-gradient(90% 60% at 50% 40%,#1E1B4B 0%,#0B1020 75%)}
#tls{display:flex;flex-direction:column;align-items:center}
.tl{display:flex;align-items:center;gap:30px;font-size:70px;font-weight:700;margin:26px 0;background:rgba(255,255,255,.08);border:2px solid rgba(255,255,255,.14);padding:22px 50px 22px 40px;border-radius:999px;white-space:nowrap}
.tl img{width:110px;height:110px}
.rdy{font-size:210px;font-weight:700}
/* الختام */
.o .l1{font-size:210px;font-weight:700;line-height:1.1;margin-top:30px}
.o .l2{font-size:66px;font-weight:700;color:#FCD34D}
.o .l3{margin-top:60px;font-size:60px;font-weight:700;background:rgba(255,255,255,.16);padding:20px 56px;border-radius:99px}
.o .l4{margin-top:36px;font-size:54px;font-weight:700}
.o .l5{margin-top:18px;font-size:58px;font-weight:700;color:#1E1B4B;background:#FCD34D;padding:10px 44px;border-radius:99px;direction:ltr}
#bar{position:absolute;top:0;right:0;height:12px;width:1080px;background:linear-gradient(90deg,#FCD34D,#F472B6,#A78BFA);transform-origin:right center}
</style></head><body><div id="stage">
<div class="blob" id="b1" style="width:900px;height:900px;left:-300px;top:-200px;background:#7C3AED"></div>
<div class="blob" id="b2" style="width:800px;height:800px;right:-300px;bottom:-100px;background:#DB2777"></div>

<div class="full" id="hook" data-in="0" data-out="7.84">
  <div class="full center" id="hkw"><div class="hk" id="hk1">طالب؟</div><div class="hk" id="hk2">أو دكتور؟</div></div>
  <div class="full" id="chaos">${CHAOS.map(([e, t], i) => {
    const y = 560 + i * 118; const right = i % 2 === 0; const x = 60 + ((i * 37) % 5) * 26;
    return `<div class="chip" id="c${i}" style="top:${y}px;${right ? 'right' : 'left'}:${x}px;rotate:${((i * 53) % 13) - 6}deg">${emoji(e, 84)}<span>${t}</span></div>`;
  }).join('')}</div>
</div>
<div class="full" id="bld" data-in="5.9" data-out="7.84"><div class="glow" id="glow"></div>
  <div class="full center" id="k"><div class="k1" id="k1">كل هذا…</div><div class="k2" id="k2">في تطبيق واحد ${emoji('eyes', 110)}</div></div></div>

<div class="full brand" id="logo" data-in="8" data-out="10.4"><div class="ring" id="rg"></div>
  <div class="full center"><div class="bm" id="bm">${markSvg}</div><div class="bn" id="bn">مذاكر</div><div class="tag" id="bt">رفيقك الجامعي</div></div></div>
${chapter('chS', 10, 'للطالب', 'mortar_board', 'كل فصلك في جيبك', '#FCD34D', '#1E1B4B')}
${STUDENT.map((s, i) => scene(`s${i}`, s, i, STUDENT.length, PAL[i % PAL.length], T_STUDENT + i * STEP)).join('')}

<div class="full" id="bld2" data-in="38" data-out="39.84" style="background:#0B1020"><div class="glow" id="glow2"></div>
  <div class="full center"><div class="k1" id="d1">وللدكتور…</div><div class="k2" id="d2">نصيب كبير ${emoji('sunglasses', 110)}</div></div></div>
${chapter('chP', 40, 'للدكتور', 'teacher', 'أدوات تختصر عليك الشغل', 'linear-gradient(165deg,#7C3AED,#312E81)', '#fff')}
${PROF.map((s, i) => scene(`p${i}`, s, i, PROF.length, PAL[(i * 3 + 5) % PAL.length], T_PROF + i * STEP)).join('')}

<div class="full" id="wall" data-in="56" data-out="60.1">
  <div class="wgrid" id="wg">${[0, 1, 2, 3].map((c) => `<div class="wcol" id="w${c}">${[...WALL.slice(c * 4, c * 4 + 4), ...WALL.slice(c * 4, c * 4 + 4)].map((f) => `<img src="${shot(f)}">`).join('')}</div>`).join('')}</div>
  <div class="full wshade"></div>
  <div class="full center"><div class="wt" id="wt">وأكثر بكثير</div><div class="wt2" id="wt2">كل فصلك… بتطبيق واحد ${emoji('rocket', 100)}</div></div>
</div>
<div class="full center" id="trust" data-in="60" data-out="63.84">
  <div id="tls">${TRUST.map(([e, t], i) => `<div class="tl" id="t${i}">${emoji(e, 110)}<span>${t}</span></div>`).join('')}</div>
  <div class="glow" id="glow3"></div>
  <div class="full center"><div class="rdy" id="rdy">جاهز؟</div></div>
</div>
<div class="full center brand o" id="out" data-in="64" data-out="99"><div class="ring" id="rg2"></div>
  <div class="bm" id="om">${markSvg}</div><div class="l1" id="o1">مذاكر</div><div class="l2" id="o2">رفيقك الجامعي</div>
  <div class="l3" id="o3">قريباً على iPhone و Android</div><div class="l4" id="o4">تابعنا عشان يوصلك أول</div><div class="l5" id="o5">@mudhaker.app</div></div>
<div id="bar"></div>
<div class="full flash" id="flash"></div>
</div></body></html>`;

function timeline(cfg) {
  const { nS, nP, TS, TP, STEP, ENTER, FOCUS } = cfg;
  const $ = (id) => document.getElementById(id);
  const ms = (s) => s * 1000;
  const POP = 'cubic-bezier(.2,1.4,.35,1)'; const OUT = 'cubic-bezier(.2,.8,.2,1)'; const IN = 'cubic-bezier(.6,0,.9,.4)';
  const A = (id, frames, start, dur, easing = OUT, fill = 'both', extra = {}) => $(id).animate(frames, { delay: ms(start), duration: ms(dur), fill, easing, ...extra });
  const pop = (id, t, from = 'scale(1.6)', dur = 0.3) => A(id, [{ opacity: 0, transform: from }, { opacity: 1, transform: 'none' }], t, dur, POP, 'backwards');
  const beat = (id, t, amt = 1.05, dur = 0.3) => $(id).animate([{ scale: amt }, { scale: 1 }], { delay: ms(t), duration: ms(dur), easing: 'ease-out', fill: 'none' });
  const flash = (t, peak = 1) => A('flash', [{ opacity: 0 }, { opacity: peak, offset: 0.06 }, { opacity: 0 }], t - 0.02, 0.4, 'linear', 'none');
  const shake = (id, t, dur, amp) => $(id).animate(Array.from({ length: 9 }, (_, k) => ({ translate: k === 8 ? '0 0' : `${(k % 2 ? -1 : 1) * amp}px ${((k * 7) % 3 - 1) * amp * 0.6}px` })), { delay: ms(t), duration: ms(dur), fill: 'none', iterations: 1 });
  $('flash').style.opacity = 0;

  // الخلفية: بقع لونية تتحرك ببطء طوال المقطع
  A('b1', [{ transform: 'translate(0,0)' }, { transform: 'translate(500px,900px)' }, { transform: 'translate(100px,1400px)' }], 0, 72, 'ease-in-out');
  A('b2', [{ transform: 'translate(0,0)' }, { transform: 'translate(-500px,-800px)' }, { transform: 'translate(-100px,-300px)' }], 0, 72, 'ease-in-out');

  // ——— 0–8: الفوضى ———
  pop('hk1', 0.0, 'scale(2.2)'); pop('hk2', 0.5, 'scale(2.2)');
  A('hkw', [{ transform: 'none' }, { transform: 'translateY(-760px) scale(.5)' }], 1.0, 0.35, OUT, 'forwards');
  for (let i = 0; i < 10; i++) {
    const t = 1.0 + i * 0.45;
    A(`c${i}`, [{ opacity: 0, transform: `scale(0) rotate(${i % 2 ? 30 : -30}deg)` }, { opacity: 1, transform: 'none' }], t, 0.32, POP, 'backwards');
    shake('chaos', t, 0.18, 10);
  }
  shake('hook', 5.4, 0.6, 22); shake('hook', 5.4 + 0.3, 0.3, 30);
  // تُسحب كل المشاكل للمركز وتختفي
  A('chaos', [{ transform: 'none', opacity: 1 }, { transform: 'scale(0) rotate(200deg)', opacity: 0 }], 5.9, 0.45, IN, 'forwards');
  A('hkw', [{ opacity: 1 }, { opacity: 0 }], 5.9, 0.3, 'linear', 'forwards');
  A('glow', [{ opacity: 0, transform: 'scale(.3)' }, { opacity: 1, transform: 'scale(1.25)' }], 6.0, 1.84, 'ease-in');
  pop('k1', 6.1, 'translateY(60px)', 0.35); pop('k2', 6.8, 'scale(.4)', 0.4);
  A('k', [{ transform: 'scale(1)' }, { transform: 'scale(1.18)' }], 6.1, 1.74, 'linear');
  for (let t = 6.0; t < 7.8; t += 0.5) beat('k2', t, 1.08);

  // ——— 8: الدروب والشعار ———
  flash(8);
  A('bm', [{ transform: 'scale(2.6) rotate(-25deg)' }, { transform: 'scale(.92) rotate(4deg)', offset: 0.72 }, { transform: 'none' }], 8, 0.5);
  A('rg', [{ transform: 'scale(.5)', opacity: 1 }, { transform: 'scale(3)', opacity: 0 }], 8, 0.8, 'ease-out');
  pop('bn', 8.25, 'translateY(100px)', 0.4); pop('bt', 8.6, 'scale(.5)', 0.35);
  for (const t of [8.5, 9.0, 9.5, 10.0]) beat('bm', t, 1.07);
  A('logo', [{ transform: 'none' }, { transform: 'scale(1.06)' }], 8.5, 1.9, 'linear', 'forwards');

  // فصل (بطاقة عنوان): تدخل بمسح دائري وخلفها نص متحرك
  const chap = (id, t) => {
    A(id, [{ clipPath: 'circle(0% at 50% 50%)' }, { clipPath: 'circle(80% at 50% 50%)' }], t, 0.35, OUT);
    A(`${id}m`, [{ transform: 'translateX(0)' }, { transform: 'translateX(1600px)' }], t, 2.4, 'linear');
    A(`${id}m2`, [{ transform: 'translateX(1600px)' }, { transform: 'translateX(0)' }], t, 2.4, 'linear');
    pop(`${id}e`, t + 0.15, 'scale(0) rotate(-60deg)', 0.45); pop(`${id}b`, t + 0.05, 'scale(2.4)', 0.35); pop(`${id}s`, t + 0.6, 'translateY(60px)', 0.35);
    for (let k = 1; k < 4; k++) beat(`${id}e`, t + k * 0.5, 1.12);
    A(`${id}b`, [{ letterSpacing: '0px' }, { letterSpacing: '12px' }], t + 0.4, 1.6, 'linear', 'forwards');
  };
  chap('chS', 10);

  // مشهد الميزة
  const REVEAL = [
    [{ clipPath: 'circle(0% at 85% 20%)' }, { clipPath: 'circle(150% at 85% 20%)' }],
    [{ clipPath: 'polygon(100% 0,100% 0,100% 100%,100% 100%)' }, { clipPath: 'polygon(-40% 0,100% 0,100% 100%,0% 100%)' }],
    [{ clipPath: 'inset(50% 0 50% 0)' }, { clipPath: 'inset(0% 0 0% 0)' }],
    [{ clipPath: 'polygon(0 0,0 0,0 100%,0 100%)' }, { clipPath: 'polygon(0 0,140% 0,100% 100%,0 100%)' }],
    [{ clipPath: 'circle(0% at 20% 85%)' }, { clipPath: 'circle(150% at 20% 85%)' }],
  ];
  const ENTERS = {
    up: [{ transform: 'translateY(1300px) rotate(12deg)' }, { transform: 'rotate(-3deg)' }],
    right: [{ transform: 'translateX(1200px) rotate(25deg)' }, { transform: 'rotate(-3deg)' }],
    left: [{ transform: 'translateX(-1200px) rotate(-25deg)' }, { transform: 'rotate(3deg)' }],
    zoom: [{ transform: 'scale(2.4)', opacity: 0 }, { transform: 'rotate(2deg)', opacity: 1 }],
    flip: [{ transform: 'perspective(1600px) rotateY(95deg)' }, { transform: 'perspective(1600px) rotateY(0) rotate(-2deg)' }],
  };
  const feature = (id, i, t, focus) => {
    const kind = ENTER[i % ENTER.length];
    A(id, REVEAL[i % REVEAL.length], t, 0.3, OUT);
    A(`${id}g`, [{ transform: 'translateX(-200px)', opacity: 0 }, { transform: 'translateX(60px)', opacity: 1 }], t, STEP + 0.3, 'ease-out');
    A(`${id}p`, ENTERS[kind], t + 0.03, 0.5, POP);
    A(`${id}q`, [{ transform: 'translateY(0)' }, { transform: 'translateY(-30px)' }], t + 0.5, STEP - 0.2, 'ease-in-out');
    pop(`${id}a`, t + 0.05, 'scale(1.8)', 0.3);
    A(`${id}h`, [{ transform: 'scaleX(0)' }, { transform: 'scaleX(1)' }], t + 0.22, 0.25, OUT);
    A(`${id}b`, [{ opacity: 0, transform: 'translateY(30px)' }, { opacity: 1, transform: 'none' }], t + 0.3, 0.25);
    A(`${id}e`, [{ transform: 'scale(0) rotate(-50deg)' }, { transform: 'scale(1.2) rotate(12deg)', offset: 0.7 }, { transform: 'rotate(-8deg)' }], t + 0.35, 0.45);
    const [fx, fy, fs] = focus; $(`${id}i`).style.transformOrigin = `${fx}% ${fy}%`;
    A(`${id}i`, [{ transform: 'scale(1)' }, { transform: `scale(${fs})` }], t + 0.95, 0.45, 'cubic-bezier(.5,0,.2,1)');
    if ($(`${id}n`)) A(`${id}n`, [{ transform: 'scale(0) rotate(20deg)' }, { transform: 'scale(1.25) rotate(-6deg)', offset: 0.7 }, { transform: 'rotate(6deg)' }], t + 0.5, 0.4);
    for (let k = 1; k < 4; k++) { beat(`${id}q`, t + k * 0.5, 1.035); beat(`${id}e`, t + k * 0.5, 1.15, 0.25); }
  };
  for (let i = 0; i < nS; i++) feature(`s${i}`, i, TS + i * STEP, FOCUS.s[i]);

  // ——— 38–40: «وللدكتور؟» ———
  A('bld2', [{ opacity: 0 }, { opacity: 1 }], 38, 0.15, 'linear');
  A('glow2', [{ opacity: 0, transform: 'scale(.3)' }, { opacity: 1, transform: 'scale(1.25)' }], 38, 1.84, 'ease-in');
  pop('d1', 38.1, 'translateY(60px)', 0.35); pop('d2', 38.8, 'scale(.4)', 0.4);
  for (let t = 39.0; t < 39.8; t += 0.25) beat('d2', t, 1.06, 0.2);
  flash(40); chap('chP', 40);
  for (let i = 0; i < nP; i++) feature(`p${i}`, i + 2, TP + i * STEP, FOCUS.p[i]);

  // ——— 56–60: جدار الشاشات ———
  flash(56, 0.7);
  A('wall', [{ opacity: 0, transform: 'scale(1.3)' }, { opacity: 1, transform: 'none' }], 56, 0.35);
  [0, 1, 2, 3].forEach((c) => A(`w${c}`, c % 2 ? [{ transform: 'translateY(-1800px)' }, { transform: 'translateY(0)' }] : [{ transform: 'translateY(0)' }, { transform: 'translateY(-1800px)' }], 56, 4.1, 'linear'));
  A('wg', [{ transform: 'perspective(2200px) rotateX(28deg) rotateZ(-14deg) scale(1)' }, { transform: 'perspective(2200px) rotateX(18deg) rotateZ(-8deg) scale(1.15)' }], 56, 4, 'ease-in-out');
  pop('wt', 56.2, 'scale(2.5)', 0.35); pop('wt2', 57.0, 'translateY(80px)', 0.35);
  for (let t = 56.5; t < 60; t += 0.5) beat('wt', t, 1.06, 0.25);

  // ——— 60–64: الخصوصية (تهدئة) ———
  A('trust', [{ opacity: 0 }, { opacity: 1 }], 60, 0.25, 'linear');
  [0, 1, 2, 3].forEach((i) => A(`t${i}`, [{ opacity: 0, transform: `translateX(${i % 2 ? -700 : 700}px)` }, { opacity: 1, transform: 'none' }], 60.1 + i * 0.45, 0.4, POP, 'backwards'));
  A('tls', [{ transform: 'none', opacity: 1 }, { transform: 'scale(.3) translateY(-600px)', opacity: 0 }], 62.2, 0.4, IN, 'forwards');
  A('glow3', [{ opacity: 0, transform: 'scale(.3)' }, { opacity: 1, transform: 'scale(1.25)' }], 62.2, 1.64, 'ease-in');
  pop('rdy', 62.5, 'scale(.3)', 0.35);
  for (let t = 63.0; t < 63.8; t += 0.25) beat('rdy', t, 1.1, 0.2);

  // ——— 64: الختام ———
  flash(64);
  A('om', [{ transform: 'scale(2.6) rotate(-25deg)' }, { transform: 'scale(.92) rotate(4deg)', offset: 0.72 }, { transform: 'none' }], 64, 0.5);
  A('rg2', [{ transform: 'scale(.5)', opacity: 1 }, { transform: 'scale(3)', opacity: 0 }], 64, 0.8, 'ease-out');
  ['o1', 'o2', 'o3', 'o4', 'o5'].forEach((id, i) => pop(id, 64.3 + i * 0.4, 'translateY(70px)', 0.35));
  for (let t = 66; t < 70; t += 0.5) beat('om', t, 1.05);
  [70, 70.25, 70.5].forEach((t, i) => { beat('om', t, 1.12 + i * 0.06, 0.25); A('rg2', [{ transform: 'scale(.5)', opacity: 0.9 }, { transform: 'scale(3)', opacity: 0 }], t, 0.7, 'ease-out', 'none'); });
  flash(70.5, 0.35);

  // شريط التقدم من الدروب الأول حتى الختام
  A('bar', [{ transform: 'scaleX(0)' }, { transform: 'scaleX(1)' }], 8, 56, 'linear');
  A('bar', [{ opacity: 1 }, { opacity: 0 }], 64, 0.2, 'linear', 'forwards', { composite: 'replace' });
  $('bar').style.opacity = 1;

  const all = document.getAnimations(); all.forEach((a) => a.pause());
  const layers = [...document.querySelectorAll('[data-in]')].map((el) => [el, +el.dataset.in, +el.dataset.out]);
  window.seek = (t) => {
    for (const [el, a, b] of layers) el.style.display = t >= a && t < b ? '' : 'none';
    for (const a of all) a.currentTime = ms(t);
  };
}

async function render(browser, from, to, out) {
  const p = await browser.newPage({ viewport: { width: 1080, height: 1920 } });
  await p.setContent(html, { waitUntil: 'load' });
  await p.evaluate(() => document.fonts.ready);
  await p.evaluate(timeline, { nS: STUDENT.length, nP: PROF.length, TS: T_STUDENT, TP: T_PROF, STEP, ENTER, FOCUS: { s: STUDENT.map((s) => s[4]), p: PROF.map((s) => s[4]) } });
  if (!out) return p;
  const ff = spawn(FFMPEG, ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(FPS), '-i', '-',
    '-c:v', 'libx264', '-preset', 'medium', '-crf', '19', '-pix_fmt', 'yuv420p', out], { stdio: ['pipe', 'inherit', 'inherit'] });
  for (let f = from; f < to; f++) {
    await p.evaluate((t) => window.seek(t), f / FPS);
    const buf = await p.screenshot({ type: 'jpeg', quality: 92 });
    if (!ff.stdin.write(buf)) await new Promise((r) => ff.stdin.once('drain', r));
    if (f === Math.round(9.2 * FPS)) fs.writeFileSync(path.join(__dirname, ID + '-cover.jpg'), buf);
    if (f % 150 === 0) console.log(`frame ${f}`);
  }
  ff.stdin.end(); await new Promise((r, j) => ff.on('close', (c) => (c ? j(new Error('ffmpeg ' + c)) : r())));
  await p.close();
}

(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROMIUM || undefined });
  if (process.env.PROOF) {
    const p = await render(b);
    const times = (process.env.TIMES || '0.3,0.7,3.5,5.6,6.4,7.5,8.3,9.2,11,12.4,13.2,19.2,25.5,37.5,38.9,40.5,43.2,46.5,53.4,57.5,60.2,61.9,63.2,65,67,70.6').split(',').map(Number);
    for (const t of times) { await p.evaluate((t) => window.seek(t), t); await p.screenshot({ path: `${process.env.PROOF}/${ID}-${t}.jpg`, type: 'jpeg', quality: 55 }); }
    await b.close(); return;
  }
  const dir = path.join(__dirname, 'silent'); fs.mkdirSync(dir, { recursive: true });
  const total = DURATION * FPS; const per = Math.ceil(total / WORKERS);
  const parts = Array.from({ length: WORKERS }, (_, k) => path.join(dir, `${ID}.part${k}.mp4`));
  await Promise.all(parts.map((out, k) => render(b, k * per, Math.min(total, (k + 1) * per), out)));
  const list = path.join(dir, `${ID}.parts.txt`); fs.writeFileSync(list, parts.map((f) => `file '${f}'`).join('\n'));
  const out = path.join(dir, ID + '.mp4');
  await new Promise((r, j) => spawn(FFMPEG, ['-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', list, '-c', 'copy', '-movflags', '+faststart', out], { stdio: 'inherit' }).on('close', (c) => (c ? j(new Error('concat ' + c)) : r())));
  [...parts, list].forEach((f) => fs.unlinkSync(f));
  console.log(out);
  await b.close();
})();
