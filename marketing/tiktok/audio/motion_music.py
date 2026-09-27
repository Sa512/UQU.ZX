"""موسيقى مقطع الموشن الكامل (72 ثانية): طبول بلا أي صوت بشري + قرار 808 + لحن قانون على مقام الحجاز.
مؤلفة برمجياً بالكامل من نفس أدوات mix.py و styles.py (بلا عينات ولا حقوق لطرف ثالث).
120 نبضة/دقيقة (المازورة ثانيتان) والأقسام مطابقة لمشاهد motion.js:
  0–8 المقدمة (المشاكل) · صمت لحظي · 8 دروب الشعار وقسم الطالب · 38–40 بناء قصير · 40 قسم الدكتور
  56–60 جدار الشاشات (ذروة) · 60–64 تهدئة (الخصوصية) · 64 الختام · 70 ثلاث ضربات النهاية.
الاستخدام: python motion_music.py <ملف الإخراج.wav>
"""
import sys, numpy as np, soundfile as sf
from mix import SR, BEAT, BAR, rng, midi, kick, riser, pad_chord, hp, lp
from styles import big_drum, tar, riq, dum, tak, group_clap, pluck_ks, sub808

DUR = 72.0
N = int(SR * DUR)
DROPS = (8.0, 40.0, 64.0)
BUILDS = ((6.0, 8.0), (38.0, 40.0), (62.0, 64.0))
PEAK = (56.0, 60.0); CALM = (60.0, 62.0); END = 70.0


def add(buf, x, at, g=1.0):
    s = int(at * SR)
    if s >= N or s + len(x) <= 0: return
    if s < 0: x = x[-s:]; s = 0
    e = min(N, s + len(x)); buf[s:e] += x[:e - s] * g


def section(t):
    if t < 6: return 'intro'
    if any(a <= t < b for a, b in BUILDS): return 'build'
    if PEAK[0] <= t < PEAK[1]: return 'peak'
    if CALM[0] <= t < CALM[1]: return 'calm'
    if t >= END: return 'end'
    return 'full'


# مقام الحجاز على ري: ري مي♭ فا# صول لا سي♭ دو ري
HIJAZ = [62, 63, 66, 67, 69, 70, 72, 74]
# جملة القانون على مازورتين (الثُمن؛ None سكتة)، والثانية ردّ عليها
PHRASE_A = [7, None, 6, 5, 4, None, 3, 2, 3, None, 2, 1, 0, None, None, None]
PHRASE_B = [4, 5, 6, 7, 6, None, 5, 4, 3, 4, 3, 2, 1, None, 0, None]
# خط القرار: ري، ري، دو، سي♭ (مازورة لكل منها)
BASS = [38, 38, 36, 34]


def music():
    drums = np.zeros(N); low = np.zeros(N); mel = np.zeros(N); fx = np.zeros(N); pad = np.zeros(N)
    darb = ['D..T..D.D..T.T..', 'D.TTD.T.D..TD.T.']
    crash = hp(rng.standard_normal(int(1.8 * SR)), 3500) * np.exp(-np.arange(int(1.8 * SR)) / SR * 2.2)
    for bi in range(int(DUR / BAR)):
        t0 = bi * BAR; sec = section(t0); prof = t0 >= 40
        for b in range(4):
            tb = t0 + b * BEAT; s = section(tb)
            if s == 'end': break
            if s == 'intro':
                if b in (0, 2): add(low, big_drum(), tb, 0.95)
                if b in (1, 3): add(drums, tar(), tb, 0.85)
                add(drums, tar(), tb + BEAT / 2, 0.3)
                if tb >= 2: add(drums, riq(), tb + BEAT / 2, 0.2)
                if tb >= 4:  # دخول الدربوكة تدريجياً
                    add(drums, dum(), tb, 0.5); add(drums, tak(), tb + BEAT * 0.75, 0.4)
                continue
            if s == 'calm':  # تهدئة: طبل كبير بنصف السرعة فقط
                if b == 0: add(low, big_drum(1.6), tb, 0.8)
                continue
            if s == 'build':
                if b in (0, 2): add(low, big_drum(), tb, 0.7)
                continue
            # full / peak
            add(low, big_drum(), tb, 1.0)
            add(drums, kick(), tb, 0.7)
            if b in (1, 3): add(drums, tar(), tb, 0.8); add(drums, group_clap(), tb, 0.7)
            if b in (0, 2): add(low, sub808(BASS[bi % 4] + 12, BEAT * 1.8, glide_from=(BASS[bi % 4] + 7 if prof and b == 2 else None), drive=2.2), tb, 0.42)
        if sec in ('full', 'peak'):
            pat = darb[1 if prof else 0]
            for k in range(16):
                tk = t0 + k * BEAT / 4
                c = pat[k]
                if sec == 'peak' and c == '.': c = 'T' if k % 2 else 'D'  # الذروة: دربوكة مضاعفة
                if c == 'D': add(drums, dum(), tk, 0.7)
                if c == 'T': add(drums, tak(), tk, 0.5)
                add(drums, riq(), tk, 0.22 if k % 2 == 0 else 0.12)
            if bi % 2 == 1:  # قفلة دربوكة آخر كل مازورتين
                for r in range(6): add(drums, tak(), t0 + 3 * BEAT + r * BEAT / 6, 0.3 + 0.05 * r)
            # القانون: جملتان تتبادلان كل مازورتين (يسكت في الذروة ليبقى الطبل وحده)
            if sec == 'full':
                ph = PHRASE_A if (bi // 2) % 2 == 0 else PHRASE_B
                shift = 12 if prof else 0
                for k in range(8):
                    i = ph[k + (8 if bi % 2 else 0)]
                    if i is None: continue
                    note = HIJAZ[i] + shift
                    add(mel, pluck_ks(midi(note), 0.6, bright=0.7), t0 + k * BEAT / 2, 0.5)
                    add(mel, pluck_ks(midi(note + 12), 0.3, bright=0.9), t0 + k * BEAT / 2 + 0.012, 0.18)
    # التهدئة والبناء الأخير: وسادة الحجاز تحت نص الخصوصية
    add(pad, pad_chord([62, 66, 69], 4.2), 60.0, 0.5)
    # البناءات: رولة دربوكة وطار تتسارع + ريزر، ثم صمت لحظي قبل كل دروب
    for a, d in BUILDS:
        t = a; k = 0; L = d - a
        while t < d - 0.16:
            frac = (t - a) / L
            add(drums, tak() if k % 2 else tar(0.12), t, 0.2 + 0.55 * frac)
            t += BEAT / (2 if frac < 0.5 else 4 if frac < 0.8 else 8); k += 1
        add(fx, riser(d - 0.15 - a) * 0.6, a, 0.2)
        g = slice(int((d - 0.16) * SR), int(d * SR))
        for bf in (drums, low, mel, fx, pad): bf[g] *= 0.0
    # الدروبات: ضربة طبل كبيرة مع صنج
    for d in DROPS:
        add(low, big_drum(1.6), d, 1.3); add(fx, crash, d, 0.14)
    # الذروة: صنج على كل مازورة
    for t in (56, 58): add(fx, crash, t, 0.1)
    # النهاية: ثلاث ضربات ثم تصفيق ورنين
    for i in range(3): add(low, big_drum(1.8 if i == 2 else 0.9), END + i * BEAT / 2, 1.0 + 0.2 * i)
    add(drums, group_clap(), END + BEAT, 0.8); add(fx, crash, END + BEAT, 0.12)
    wet = np.zeros(N)  # صدى ساحة واسعة
    src = drums + low + mel * 0.6
    for dms, g in ((83, .22), (149, .15), (241, .1)):
        k2 = int(dms / 1000 * SR); wet[k2:] += src[:-k2] * g
    m = drums + low * 1.1 + mel * 0.9 + fx + pad * 0.6 + lp(wet, 2500) * 0.6
    m = m / (np.percentile(np.abs(m), 99.9) + 1e-9)
    m = np.tanh(m * 1.3) / 1.3
    for a, d in BUILDS:  # الصمت اللحظي يشمل الصدى أيضاً
        s0 = int((d - 0.16) * SR); s1 = int(d * SR); r = int(0.03 * SR)
        m[s0 - r:s0] *= np.linspace(1, 0, r); m[s0:s1] = 0
    fi = int(0.02 * SR); fo = int(1.0 * SR)
    m[:fi] *= np.linspace(0, 1, fi); m[-fo:] *= np.linspace(1, 0, fo)
    return m / (np.max(np.abs(m)) + 1e-9) * 0.95


if __name__ == '__main__':
    out = sys.argv[1] if len(sys.argv) > 1 else 'motion.wav'
    x = music()
    sf.write(out, np.stack([x, x], 1).astype(np.float32), SR)
    print(out)
