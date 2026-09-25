"""أنماط موسيقية إضافية للمقاطع، كلها مؤلفة برمجياً من الصفر (بلا عينات ولا حقوق لطرف ثالث).
كل نمط يلتزم بنفس شبكة التوقيت في mix.py حتى تبقى متزامنة مع الصورة:
المقدمة 0–2.9 · البناء 2.9–6.75 · صمت لحظي · الدروب 6.9 · الختام 12.9.
"""
import numpy as np
from scipy import signal as sg
import mix
from mix import (SR, N, BEAT, BAR, GRID0, DROP, BUILD, OUT, rng, midi, env, add, lp, hp, bp,
                 kick, clap, hat, riser, supersaw, snare)

BARS = [GRID0 + i * BAR for i in range(-1, 8)]


def finish(parts, drive=1.8):
    """دمج وتشبّع خفيف وتلاشٍ ثم تطبيع."""
    m = sum(parts)
    m = np.tanh(m * drive) / drive
    fade = np.ones(N); fi = int(0.02 * SR); fo = int(0.5 * SR)
    fade[:fi] = np.linspace(0, 1, fi); fade[-fo:] = np.linspace(1, 0, fo)
    m = m * fade
    return m / (np.max(np.abs(m)) + 1e-9)


def silence_gap(*bufs):
    g = slice(int((DROP - 0.16) * SR), int(DROP * SR))
    for b in bufs: b[g] *= 0.0


def pluck_ks(f, dur, bright=0.5, decay=0.996):
    """وتر منقور (Karplus-Strong) بمرشح تغذية راجعة: صوت قريب من العود والقانون."""
    n = int(dur * SR); P = max(2, int(SR / f))
    x = np.zeros(n); burst = rng.uniform(-1, 1, P)
    x[:P] = lp(burst, 1500 + 6000 * bright)[:P]
    a = np.zeros(P + 2); a[0] = 1; a[P] = -0.5 * decay; a[P + 1] = -0.5 * decay
    return sg.lfilter([1], a, x) * np.minimum(1, np.arange(n) / (0.002 * SR))


def sub808(note, dur, glide_from=None, drive=3.0):
    n = int(dur * SR); tt = np.arange(n) / SR; f1 = midi(note - 24)
    f = f1 if glide_from is None else midi(glide_from - 24) + (f1 - midi(glide_from - 24)) * np.minimum(1, tt / 0.08)
    ph = 2 * np.pi * np.cumsum(np.full(n, f) if np.isscalar(f) else f) / SR
    return np.tanh(drive * np.sin(ph)) * np.minimum(1, tt / 0.005) * np.exp(-tt * 1.3)


# ——— 1) فونك (Phonk): جرس «كاوبل» ولحن سريع و808 مشوّه — من أشهر أنماط تيك توك ———
def cowbell(note, dur=0.18):
    n = int(dur * SR); tt = np.arange(n) / SR; f = midi(note)
    x = sg.square(2 * np.pi * f * tt) + sg.square(2 * np.pi * f * 1.48 * tt)
    return bp(x, 500, 5000) * np.exp(-tt * 16)


def music_phonk():
    drums = np.zeros(N); bass = np.zeros(N); bell = np.zeros(N); fx = np.zeros(N)
    riff = [77, 77, 80, 77, 84, 82, 80, 77, 77, 77, 80, 84, 87, 84, 82, 80]  # فا صغير
    roots = [41, 41, 44, 39]
    for bi, t0 in enumerate(BARS):
        if t0 >= OUT or t0 + BAR <= 0: continue
        drop = t0 >= DROP - 0.01
        for k, note in enumerate(riff):
            tk = t0 + k * BEAT / 4
            if 0 <= tk < OUT and (drop or tk >= 0.0):
                add(bell, cowbell(note + (12 if drop and k % 4 == 0 else 0)), tk, 0.5 if drop else 0.38)
        for b in range(4):
            tb = t0 + b * BEAT
            if tb < 0 or tb >= OUT: continue
            if drop:
                if b in (0, 2): add(drums, kick(), tb, 1.0); add(bass, sub808(roots[bi % 4] + 12, BEAT * 1.8, glide_from=roots[bi % 4] + (19 if b == 2 else 12)), tb, 0.9)
                if b in (1, 3): add(drums, clap(), tb, 0.7); add(drums, snare(), tb, 0.3)
                for h in range(4 if b != 3 else 8):
                    add(drums, hat(), tb + h * BEAT / (4 if b != 3 else 8), 0.1)
            elif tb >= BUILD - 0.01:
                add(drums, kick(), tb, 0.6 if b % 2 == 0 else 0.0)
                for h in range(2): add(drums, hat(), tb + h * BEAT / 2, 0.08)
    for i in range(16):  # طبل متسارع قبل الدروب
        t = DROP - BAR + i * BAR / 16 * (1 - i / 40)
        if t < DROP - 0.16: add(drums, snare(), t, 0.1 + 0.02 * i)
    add(fx, riser(DROP - 0.15 - (DROP - BAR)), DROP - BAR, 0.28)
    silence_gap(drums, bass, bell)
    crash = hp(rng.standard_normal(int(1.6 * SR)), 3500) * np.exp(-np.arange(int(1.6 * SR)) / SR * 2.4)
    add(fx, crash, DROP, 0.16); add(fx, kick(), DROP, 0.8); add(fx, kick(), OUT, 0.8); add(fx, crash, OUT, 0.12)
    add(bass, sub808(41, 2.5), OUT, 0.8)
    intro = np.ones(N); ie = int(BUILD * SR); intro[:ie] = 0.6 + 0.4 * np.linspace(0, 1, ie)
    return finish([drums, bass * 0.9, lp(bell, 6000) * intro, fx], drive=2.2)


# ——— 2) ملحمي سينمائي: نبض ساعة، أوتار تتصاعد، ثم «براام» وطبول تايكو ———
def taiko(pitch=70, dur=0.6):
    n = int(dur * SR); tt = np.arange(n) / SR
    f = pitch * (1 + 1.5 * np.exp(-tt * 30))
    body = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-tt * 6)
    return body + lp(rng.standard_normal(n), 900) * np.exp(-tt * 25) * 0.6


def braam(notes, dur):
    n = int(dur * SR); tt = np.arange(n) / SR; x = np.zeros(n)
    for note in notes:
        for det in (-0.15, 0, 0.15):
            x += sg.sawtooth(2 * np.pi * midi(note) * 2 ** (det / 12) * tt + rng.random() * 6)
    cutoff = 300 + 2200 * np.exp(-tt * 1.2)
    out = np.zeros(n); seg = int(0.02 * SR)
    for i in range(0, n, seg):
        out[i:i + seg] = lp(x[max(0, i - 2000):i + seg], cutoff[i])[-len(out[i:i + seg]):]
    return np.tanh(out / len(notes) * 1.5) * np.minimum(1, tt / 0.03) * np.exp(-tt * 0.6)


def music_epic():
    perc = np.zeros(N); strings = np.zeros(N); low = np.zeros(N); fx = np.zeros(N)
    # المقدمة: نقرة ساعة على كل نبضة ونغمة قرار منخفضة
    t = GRID0 - BAR
    while t < BUILD:
        if t >= 0:
            n = int(0.05 * SR); add(perc, hp(rng.standard_normal(n), 4000) * np.exp(-np.arange(n) / SR * 90), t, 0.22)
        t += BEAT
    drone_n = int(DROP * SR); tt = np.arange(drone_n) / SR
    add(low, (np.sin(2 * np.pi * midi(38) * tt) + 0.4 * np.sin(2 * np.pi * midi(45) * tt)) * np.minimum(1, tt / 1.0), 0, 0.18)
    # البناء: أوتار تتصاعد بدرجات متقاربة
    chord = [50, 57, 62, 65]
    s = supersaw(chord, DROP - BUILD, 1400); s *= np.linspace(0.1, 1, len(s)) ** 2
    add(strings, s, BUILD, 0.3)
    for i in range(24):
        tk = BUILD + 1.0 + i * (DROP - BUILD - 1.2) / 24
        add(perc, taiko(110, 0.3), tk, 0.05 + 0.012 * i)
    add(fx, riser(DROP - 0.15 - 4.9), 4.9, 0.3)
    # الدروب: براام + تايكو على كل نبضة + أوتار نابضة
    add(low, braam([26, 33, 38], 3.0), DROP, 1.0)
    add(low, braam([29, 36, 41], 2.2), DROP + 2 * BAR / 2 + 1.0, 0.8)
    for bi, t0 in enumerate(BARS):
        if t0 < DROP - 0.01 or t0 >= OUT: continue
        for b in range(4):
            tb = t0 + b * BEAT
            add(perc, taiko(65 if b % 2 == 0 else 90), tb, 1.4 if b == 0 else 1.0)
            if b == 3: add(perc, taiko(120, 0.25), tb + BEAT / 2, 0.5)
        ost = [62, 62, 65, 62, 69, 62, 65, 62]
        for k, note in enumerate(ost):
            x = supersaw([note], BEAT / 2, 3000) * env(int(BEAT / 2 * SR), 0.004, 0.12)
            add(strings, x, t0 + k * BEAT / 2, 0.7)
    silence_gap(perc, strings, low, fx)
    crash = hp(rng.standard_normal(int(2.5 * SR)), 2500) * np.exp(-np.arange(int(2.5 * SR)) / SR * 1.6)
    add(fx, crash, DROP, 0.2); add(perc, taiko(55, 1.2), OUT, 1.2); add(fx, crash, OUT, 0.15)
    add(low, braam([26, 38, 45], 3.0), OUT, 0.9)
    # صدى قاعة
    wet = np.zeros(N)
    for dms, g in ((67, .3), (113, .22), (179, .15), (271, .1)):
        k = int(dms / 1000 * SR); wet[k:] += (perc + strings)[:-k] * g
    return finish([perc, strings * 0.8, low, fx, lp(wet, 3000) * 0.5], drive=1.6)


# ——— 3) خليجي: دُم وتك وتصفيق جماعي، وعود بمقام الحجاز ———
HIJAZ = [62, 63, 66, 67, 69, 70, 72, 74]  # ري حجاز


def dum():
    n = int(0.35 * SR); tt = np.arange(n) / SR
    f = 90 * (1 + 0.8 * np.exp(-tt * 40))
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-tt * 9)


def tak():
    n = int(0.09 * SR); tt = np.arange(n) / SR
    return (np.sin(2 * np.pi * 1800 * tt) * 0.5 + bp(rng.standard_normal(n), 2500, 8000)) * np.exp(-tt * 55)


def group_clap():
    x = np.zeros(int(0.3 * SR))
    for off in (0, 0.007, 0.013, 0.021):  # عدة أيادٍ بفروق بسيطة
        c = clap(); s = int(off * SR); m = min(len(c), len(x) - s); x[s:s + m] += c[:m] * rng.uniform(0.6, 1)
    return x / 2


def music_khaleeji():
    perc = np.zeros(N); oud = np.zeros(N); bass = np.zeros(N); pad = np.zeros(N); fx = np.zeros(N)
    # إيقاع على السادس عشر: D = دُم، T = تك، C = تصفيق
    pat = 'D.T.D.T.DDT.T.C.'
    phrase = [2, 1, 2, 3, 4, 3, 2, 1, 0, 1, 2, 1, 0, None, 0, None]  # درجات من مقام الحجاز
    for bi, t0 in enumerate(BARS):
        if t0 >= OUT or t0 + BAR <= 0: continue
        drop = t0 >= DROP - 0.01; build = t0 >= BUILD - 0.01
        for k in range(16):
            tk = t0 + k * BEAT / 4
            if tk < 0 or tk >= OUT: continue
            c = pat[k]
            if c == 'D' and build: add(perc, dum(), tk, 0.9 if drop else 0.6)
            if c == 'T': add(perc, tak(), tk, 0.45 if drop else 0.3)
            if c == 'C' and drop: add(perc, group_clap(), tk, 0.6)
            if drop and k % 4 == 2: add(perc, group_clap(), tk, 0.35)
            if drop and c == 'D': add(bass, sub808(HIJAZ[0] - 12, BEAT, drive=2.0), tk, 0.6)
        # جملة العود (ثُمن) وتُضاعف بالقانون بعد الدروب
        for j in range(8):
            deg = phrase[(j + (8 if bi % 2 else 0)) % 16]
            tk = t0 + j * BEAT / 2
            if deg is None or tk < 0 or tk >= OUT: continue
            note = HIJAZ[deg]
            add(oud, pluck_ks(midi(note - 12), 0.7, 0.35), tk, 0.7)
            if drop: add(oud, pluck_ks(midi(note), 0.5, 0.8, 0.993), tk + 0.012, 0.45)
    n = int(OUT * SR); tt = np.arange(n) / SR
    add(pad, lp(sg.sawtooth(2 * np.pi * midi(50) * tt) + sg.sawtooth(2 * np.pi * midi(57) * 1.003 * tt), 800) * np.minimum(1, tt / 2), 0, 0.12)
    add(fx, riser(DROP - 0.15 - 4.9), 4.9, 0.22)
    silence_gap(perc, oud, bass, pad, fx)
    add(perc, dum(), DROP, 1.0); add(perc, group_clap(), DROP, 0.8)
    add(perc, dum(), OUT, 1.0); add(perc, group_clap(), OUT, 0.7)
    for i, deg in enumerate([7, 4, 2, 0]):  # قفلة
        add(oud, pluck_ks(midi(HIJAZ[deg] - 12), 1.4, 0.4), OUT + 0.15 + i * 0.22, 0.7)
    return finish([perc, oud, bass, pad, fx], drive=1.7)


# ——— 4) أفرو هاوس / أمابيانو: «لوق درم» وشيكر وكوردات بيانو — نمط راقص رائج ———
def log_drum(note, dur=0.35):
    n = int(dur * SR); tt = np.arange(n) / SR; f = midi(note) * (1 + 0.6 * np.exp(-tt * 35))
    return np.tanh(2.5 * np.sin(2 * np.pi * np.cumsum(f) / SR)) * np.exp(-tt * 7)


def shaker():
    n = int(0.06 * SR); return hp(rng.standard_normal(n), 6000) * np.hanning(n)


def music_afro():
    drums = np.zeros(N); logd = np.zeros(N); keys = np.zeros(N); fx = np.zeros(N)
    chords = [[57, 60, 64, 67], [53, 57, 60, 64], [55, 59, 62, 65], [52, 55, 59, 62]]
    bassline = [(0, 45), (0.75, 45), (1.5, 48), (2.5, 50), (3.0, 52)]  # بالنبضات
    for bi, t0 in enumerate(BARS):
        if t0 >= OUT or t0 + BAR <= 0: continue
        drop = t0 >= DROP - 0.01; build = t0 >= BUILD - 0.01
        ch = chords[bi % 4]
        for k in range(16):
            tk = t0 + k * BEAT / 4
            if 0 <= tk < OUT: add(drums, shaker(), tk, (0.14 if k % 2 else 0.07) * (1 if build else 0.8))
        for b in range(4):
            tb = t0 + b * BEAT
            if tb < 0 or tb >= OUT: continue
            if drop or b % 2 == 0: add(drums, kick(), tb, 0.9 if drop else 0.55 if build else 0.4)
            if drop and b in (1, 3): add(drums, clap(), tb + BEAT / 4 * 0, 0.4)
            # كورد على الـ off-beat
            x = supersaw(ch, BEAT * 0.4, 2400) * env(int(BEAT * 0.4 * SR), 0.003, 0.12)
            add(keys, x, tb + BEAT / 2, 0.55 if drop else 0.5)
        if drop:
            for pos, note in bassline:
                add(logd, log_drum(note + (12 if bi % 2 and pos > 2 else 0)), t0 + pos * BEAT, 0.9)
    add(fx, riser(DROP - 0.15 - 4.9), 4.9, 0.22)
    silence_gap(drums, logd, keys, fx)
    add(fx, kick(), DROP, 0.8); add(logd, log_drum(45, 0.8), DROP, 1.0)
    add(fx, kick(), OUT, 0.8); add(logd, log_drum(45, 1.2), OUT, 0.9)
    tail = supersaw([57, 60, 64, 69], 2.8, 1600); tail *= np.linspace(1, 0, len(tail)) ** 1.5
    add(keys, tail, OUT, 0.5)
    return finish([drums, logd, keys, fx], drive=1.8)


STYLES = {'phonk': music_phonk, 'epic': music_epic, 'khaleeji': music_khaleeji, 'afro': music_afro}


# ——— 5) جيرسي كلوب: نمط الكيك الشهير «بوم بوم بوم-بوم» وصرير السرير وتقطيعات صوتية ———
def squeak(dur=0.12):
    n = int(dur * SR); tt = np.arange(n) / SR
    f = 1300 + 700 * (tt / dur) + 60 * np.sin(2 * np.pi * 38 * tt)
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.hanning(n) * 0.6


def vox(note, dur=0.16, vowel='a'):
    """تقطيع صوتي اصطناعي (بلا تسجيلات): سن منشاري عبر مرشحات بترددات حروف العلة."""
    n = int(dur * SR); tt = np.arange(n) / SR; f = midi(note)
    src = sg.sawtooth(2 * np.pi * f * tt) + 0.5 * sg.sawtooth(2 * np.pi * f * 1.004 * tt)
    fm = {'a': (800, 1200), 'o': (500, 900), 'e': (500, 1900)}[vowel]
    out = bp(src, fm[0] * 0.8, fm[0] * 1.25) + 0.7 * bp(src, fm[1] * 0.85, fm[1] * 1.2)
    return out * env(n, 0.005, 0.07)


def music_jersey():
    drums = np.zeros(N); bass = np.zeros(N); chops = np.zeros(N); fx = np.zeros(N)
    kick_pos = [0, 3, 6, 8, 10]  # بالسادس عشر
    chop_line = [(0, 69, 'a'), (3, 72, 'e'), (6, 74, 'a'), (10, 72, 'o'), (12, 69, 'a'), (14, 67, 'e')]
    roots = [45, 41, 43, 40]
    for bi, t0 in enumerate(BARS):
        if t0 >= OUT or t0 + BAR <= 0: continue
        drop = t0 >= DROP - 0.01; build = t0 >= BUILD - 0.01
        for half in (0, 1):
            h0 = t0 + half * 2 * BEAT
            for k in kick_pos:
                if h0 + k * BEAT / 4 >= 0: add(drums, kick(), h0 + k * BEAT / 4, 1.0 if drop else 0.55 if build else 0.3)
            if drop: add(drums, clap(), h0 + BEAT, 0.6); add(drums, squeak(), h0 + 1.5 * BEAT, 0.35)
        for k in range(16):
            tk = t0 + k * BEAT / 4
            if 0 <= tk < OUT and (drop or k % 2 == 0): add(drums, hat(), tk, 0.08 if drop else 0.05)
        for pos, note, v in chop_line:
            tk = t0 + pos * BEAT / 4
            if 0 <= tk < OUT: add(chops, vox(note + (12 if drop and pos in (6, 12) else 0), 0.16, v), tk, 0.9 if drop else 0.6)
        if drop:
            add(bass, sub808(roots[bi % 4] + 12, BAR * 0.95, drive=2.0), t0, 0.7)
    add(fx, riser(DROP - 0.15 - 4.9), 4.9, 0.25)
    silence_gap(drums, bass, chops, fx)
    add(fx, kick(), DROP, 0.8); add(fx, squeak(0.2), DROP + 0.1, 0.4); add(fx, kick(), OUT, 0.8)
    add(chops, vox(81, 0.6, 'a'), OUT, 0.8)
    return finish([drums, bass, lp(chops, 7000), fx], drive=2.0)


# ——— 6) دريل: 808 ينزلق بين النغمات، هاي هات بثلاثيات، سنير على النبضة الثالثة، لحن داكن ———
def music_drill():
    drums = np.zeros(N); bass = np.zeros(N); mel = np.zeros(N); fx = np.zeros(N)
    melody = [64, 65, 67, 65, 64, 62, 64, None]  # مي فريجي: قاتم ومشدود
    slides = [(0, 40, None), (1.5, 40, 43), (2.5, 38, 40), (3.25, 41, 38)]
    kicks = [0, 1.5, 2.75]
    for bi, t0 in enumerate(BARS):
        if t0 >= OUT or t0 + BAR <= 0: continue
        drop = t0 >= DROP - 0.01; build = t0 >= BUILD - 0.01
        for j, note in enumerate(melody):
            tk = t0 + j * BEAT / 2
            if note is None or tk < 0 or tk >= OUT: continue
            add(mel, pluck_ks(midi(note + 12), 0.6, 0.7, 0.994), tk, 0.6 if drop else 0.9)
            if drop: add(mel, pluck_ks(midi(note), 0.5, 0.3), tk + 0.01, 0.4)
        if not drop:
            for b in range(4):
                if t0 + b * BEAT >= 0: add(drums, hat(), t0 + b * BEAT, 0.08); add(drums, hat(), t0 + b * BEAT + BEAT / 2, 0.05)
            if t0 >= 0: add(bass, sub808(52, BEAT * 2, drive=1.5), t0, 0.5 if build else 0.35)
        if build:
            add(drums, snare(), t0 + 2 * BEAT, 0.9 if drop else 0.5); add(drums, clap(), t0 + 2 * BEAT, 0.4 if drop else 0.2)
            for b in range(4):
                tb = t0 + b * BEAT
                trip = drop and b == 3
                for h in range(3 if trip else 2):
                    add(drums, hat(), tb + h * BEAT / (3 if trip else 2), 0.1)
        if drop:
            for k in kicks: add(drums, kick(), t0 + k * BEAT, 0.9)
            for pos, note, frm in slides:
                add(bass, sub808(note + 12, BEAT * 1.2, glide_from=None if frm is None else frm + 12, drive=2.6), t0 + pos * BEAT, 0.9)
    add(fx, riser(DROP - 0.15 - 4.9), 4.9, 0.22)
    silence_gap(drums, bass, mel, fx)
    add(fx, kick(), DROP, 0.8); add(bass, sub808(52, 1.8, glide_from=40), DROP, 0.8)
    add(fx, kick(), OUT, 0.8); add(bass, sub808(40, 2.5), OUT, 0.8)
    return finish([drums, bass, mel, fx], drive=2.0)


# ——— 7) فانك برازيلي (مونتاجم): إيقاع «تامبورزاو»، ضربات 808 مشبّعة وجرس متكرر ———
def music_funk():
    drums = np.zeros(N); bass = np.zeros(N); bell = np.zeros(N); fx = np.zeros(N)
    tambor = 'X..X..X...X..X..'  # بالسادس عشر
    riff = [81, None, 81, 84, None, 81, 79, None, 81, None, 84, 86, None, 84, 81, None]
    for bi, t0 in enumerate(BARS):
        if t0 >= OUT or t0 + BAR <= 0: continue
        drop = t0 >= DROP - 0.01; build = t0 >= BUILD - 0.01
        for k in range(16):
            tk = t0 + k * BEAT / 4
            if tk < 0 or tk >= OUT: continue
            if riff[k] is not None: add(bell, cowbell(riff[k] - 12, 0.12), tk, 0.45 if drop else 0.35)
            if tambor[k] == 'X' and build:
                add(drums, kick(), tk, 1.0 if drop else 0.5)
                if drop: add(bass, sub808(45 + (5 if k == 10 else 0) + 12, BEAT * 0.7, drive=4.0), tk, 0.8)
            if drop and k in (4, 12): add(drums, clap(), tk, 0.7)
            if drop and k % 2: add(drums, hat(), tk, 0.08)
    add(fx, riser(DROP - 0.15 - 4.9), 4.9, 0.25)
    silence_gap(drums, bass, bell, fx)
    add(fx, kick(), DROP, 0.9); add(bass, sub808(57, 0.8, drive=4.0), DROP, 0.9)
    add(fx, kick(), OUT, 0.9); add(bass, sub808(45, 2.4, drive=3.0), OUT, 0.8)
    return finish([drums, bass, bell, fx], drive=2.6)


# ——— 8) فيوتشر بيس: كوردات عريضة «تتنفس» مع الطبل ولحن سهل يعلق في الراس ———
def music_futurebass():
    drums = np.zeros(N); chords = np.zeros(N); lead = np.zeros(N); bass = np.zeros(N); fx = np.zeros(N)
    prog = [[60, 64, 67, 71], [57, 60, 64, 67], [53, 57, 60, 64], [55, 59, 62, 67]]
    hook = [(0, 76), (0.5, 79), (1, 76), (1.5, 74), (2, 72), (2.5, 74), (3, 76), (3.75, 79)]  # سهل الحفظ
    pump = np.ones(N)
    for bi, t0 in enumerate(BARS):
        if t0 >= OUT or t0 + BAR <= 0: continue
        drop = t0 >= DROP - 0.01; build = t0 >= BUILD - 0.01
        ch = prog[bi % 4]
        if drop:
            for k in range(8):  # كوردات مقطّعة على الثُمن
                x = supersaw(ch + [ch[0] + 12], BEAT / 2 * 0.9, 4200) * env(int(BEAT / 2 * 0.9 * SR), 0.004, 0.25)
                add(chords, x, t0 + k * BEAT / 2, 0.7)
            for pos, note in hook:
                if bi % 2 and pos >= 3: note += 2
                add(lead, lead_tone(note, BEAT * 0.5), t0 + pos * BEAT, 0.5)
            add(bass, sub808(ch[0] + 12, BAR * 0.95, drive=1.5), t0, 0.6)
        elif t0 + BAR > 0:
            x = supersaw(ch, BAR, 1800 if not build else 2600); add(chords, x, max(0, t0), 0.45 if build else 0.5)
            if t0 >= 0:
                for pos, note in hook: add(lead, pluck_ks(midi(note), 0.5, 0.8), t0 + pos * BEAT, 0.55)
        for b in range(4):
            tb = t0 + b * BEAT
            if tb < 0 or tb >= OUT: continue
            if drop:
                add(drums, kick(), tb, 1.0)
                kk = int(tb * SR); m = min(N - kk, int(0.3 * SR))
                pump[kk:kk + m] = np.minimum(pump[kk:kk + m], 1 - 0.65 * np.exp(-np.arange(m) / SR * 10))
                if b in (1, 3): add(drums, snare(), tb, 0.5); add(drums, clap(), tb, 0.5)
                add(drums, hat(open_=True), tb + BEAT / 2, 0.1)
            elif build and b % 2 == 0: add(drums, kick(), tb, 0.5)
    for i in range(16):
        t = DROP - BAR + i * BAR / 16
        if t < DROP - 0.16: add(drums, snare(), t, 0.08 + 0.025 * i)
    add(fx, riser(DROP - 0.15 - 4.9), 4.9, 0.25)
    silence_gap(drums, chords, lead, bass, fx)
    add(fx, kick(), DROP, 0.8); add(fx, kick(), OUT, 0.8)
    tail = supersaw([60, 64, 67, 72], 2.8, 2000); tail *= np.linspace(1, 0, len(tail)) ** 1.5
    add(chords, tail, OUT, 0.6)
    d = int(BEAT * 0.75 * SR); wet = np.zeros(N)
    for k, g in enumerate((0.3, 0.15), 1): wet[k * d:] += lead[:N - k * d] * g
    return finish([drums, chords * pump, lead + wet, bass, fx], drive=1.8)


def lead_tone(note, dur):
    n = int(dur * SR); tt = np.arange(n) / SR; f = midi(note) * (1 + 0.004 * np.sin(2 * np.pi * 6 * tt))
    ph = 2 * np.pi * np.cumsum(f) / SR
    return lp(sg.sawtooth(ph) + 0.5 * sg.square(ph / 2), 5000) * env(n, 0.005, 0.25)


STYLES.update({'jersey': music_jersey, 'drill': music_drill, 'funk': music_funk, 'futurebass': music_futurebass})


# ——— 9) طبول (بدون أي صوت بشري): طبل العرضة العميق، طار، دربوكة، رِق، وتصفيق جماعي ———
def big_drum(dur=1.1):
    """طبل كبير عميق (قريب من طبل العرضة): قرار منخفض ينزل من 110 إلى 55 هرتز مع ضربة جلد."""
    n = int(dur * SR); tt = np.arange(n) / SR
    f = 55 * (1 + 1.0 * np.exp(-tt * 18))
    body = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-tt * 3.2)
    skin = lp(rng.standard_normal(n), 700) * np.exp(-tt * 30) * 0.8
    return np.tanh(1.8 * (body + skin))


def tar(dur=0.22):
    """طار (دف كبير): صفعة جلد متوسطة."""
    n = int(dur * SR); tt = np.arange(n) / SR
    return bp(rng.standard_normal(n), 180, 1400) * np.exp(-tt * 22) * 1.4 + np.sin(2 * np.pi * 140 * tt) * np.exp(-tt * 18) * 0.6


def riq(dur=0.14):
    """رِق (دف بصنوج): رنين معدني قصير."""
    n = int(dur * SR); tt = np.arange(n) / SR
    x = sum(np.sin(2 * np.pi * f * tt + rng.random() * 6) for f in (4700, 6300, 8100, 9900)) / 4
    return (x * 0.6 + hp(rng.standard_normal(n), 6000) * 0.5) * np.exp(-tt * 28)


def music_tubool():
    drums = np.zeros(N); low = np.zeros(N); fx = np.zeros(N)
    # إيقاع الدربوكة على السادس عشر في البناء والدروب
    darb = 'D..T..D.D..T.T..'
    for bi, t0 in enumerate(BARS):
        if t0 >= OUT or t0 + BAR <= 0: continue
        drop = t0 >= DROP - 0.01; build = t0 >= BUILD - 0.01
        for b in range(4):
            tb = t0 + b * BEAT
            if tb < 0 or tb >= OUT: continue
            # الطبل الكبير: على الأولى والثالثة في المقدمة، وعلى كل نبضة في الدروب
            if b in (0, 2) or drop:
                add(low, big_drum(), tb, 1.0 if drop else 0.75 if build else 0.6)
            if drop: add(drums, kick(), tb, 0.7)
            # الطار على النبضات الضعيفة، والتصفيق الجماعي في الدروب
            if b in (1, 3): add(drums, tar(), tb, 0.8 if drop else 0.6)
            if drop and b in (1, 3): add(drums, group_clap(), tb, 0.7)
            if not build: add(drums, tar(), tb + BEAT / 2, 0.25)
        if build:
            for k in range(16):
                tk = t0 + k * BEAT / 4
                if tk >= OUT: continue
                c = darb[k]
                if c == 'D': add(drums, dum(), tk, 0.7 if drop else 0.5)
                if c == 'T': add(drums, tak(), tk, 0.5 if drop else 0.4)
                if drop: add(drums, riq(), tk, 0.22 if k % 2 == 0 else 0.12)
                elif k % 4 == 2: add(drums, riq(), tk, 0.12)
        if drop and bi % 2 == 1:  # قفلة دربوكة سريعة آخر كل مازورتين
            for r in range(6): add(drums, tak(), t0 + 3 * BEAT + r * BEAT / 6, 0.3 + 0.05 * r)
    # قبل الدروب: رولة دربوكة وطار تتسارع وتعلو
    roll_start = DROP - BAR
    k = 0; t = roll_start
    while t < DROP - 0.16:
        frac = (t - roll_start) / BAR
        add(drums, tak() if k % 2 else tar(0.12), t, 0.2 + 0.5 * frac)
        t += BEAT / (2 if frac < 0.5 else 4 if frac < 0.8 else 8); k += 1
    add(fx, riser(DROP - 0.15 - roll_start) * 0.6, roll_start, 0.18)
    silence_gap(drums, low, fx)
    # الدروب: ضربة طبل كبيرة مع صنج وقرار 808
    crash = hp(rng.standard_normal(int(1.8 * SR)), 3500) * np.exp(-np.arange(int(1.8 * SR)) / SR * 2.2)
    add(low, big_drum(1.6), DROP, 1.3); add(fx, crash, DROP, 0.14); add(low, sub808(33 + 12, 1.2, drive=2.0), DROP, 0.5)
    for i in range(3):  # الختام: ثلاث ضربات طبل ثم رنين
        add(low, big_drum(1.8 if i == 2 else 0.9), OUT + i * BEAT / 2, 1.0 + 0.2 * i)
    add(drums, group_clap(), OUT + BEAT, 0.8); add(fx, crash, OUT + BEAT, 0.12)
    # صدى ساحة واسعة (العرضة في الهواء الطلق)
    wet = np.zeros(N)
    for dms, g in ((83, .22), (149, .15), (241, .1)):
        k2 = int(dms / 1000 * SR); wet[k2:] += (drums + low)[:-k2] * g
    return finish([drums, low * 1.1, fx, lp(wet, 2500) * 0.6], drive=1.9)


STYLES['tubool'] = music_tubool
