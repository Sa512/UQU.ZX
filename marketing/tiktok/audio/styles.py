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
