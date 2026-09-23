"""يولّد الصوت لمقاطع تيك توك: تعليق صوتي عربي (Piper عبر sherpa-onnx) + موسيقى بنمط الترند مؤلفة برمجياً (دروب عند ظهور النتيجة).
الموسيقى مولّدة بالكامل هنا (بدون عينات خارجية) فلا توجد عليها حقوق لطرف ثالث.
الاستخدام: python mix.py <مجلد نموذج الصوت> <مجلد الإخراج> [--no-voice]
"""
import sys, os, numpy as np, soundfile as sf

SR = 44100
DUR = 16.0
N = int(SR * DUR)
rng = np.random.default_rng(7)

# النصوص بالتشكيل حتى يُنطق الكلام صحيحاً. (الوقت بالثواني، النص)
SCRIPTS = {
    '01-final-grade': [
        (0.25, 'بَاقِي النِّهَائِيّ مِنْ أَرْبَعِين. كَمْ تَحْتَاج عَشَان تْجِيب إِيه؟'),
        (6.9, 'تَحْتَاج خَمْسَةً وَثَلَاثِينَ وَنِصْف.'),
        (9.95, 'وَيَحْسِبُهَا لَكَ لِكُلِّ تَقْدِير.'),
    ],
    '02-absence': [
        (0.25, 'الحِرْمَانُ خَمْسَةٌ وَعِشْرُونَ بِالمِئَة. طَيِّب، كَمْ غِيَاب بَاقِي لِي؟'),
        (6.9, 'بَاقِي لَكَ غِيَابٌ وَاحِدٌ بَسّ.'),
        (9.95, 'وَيُحَذِّرُكَ قَبْلَ الحِرْمَان.'),
    ],
    '03-qr-attendance': [
        (0.25, 'دُكْتُورُنَا صَارَ يُحَضِّر بْكِيُو آر. وَالرَّمْزُ يَتَغَيَّرُ كُلَّ رُبْعِ دَقِيقَة.'),
        (6.9, 'وَلَا أَحَد يُحَضِّر عَنْ أَحَد.'),
        (9.95, 'وَالحُضُورُ يُسَجَّلُ تِلْقَائِيًّا.'),
    ],
}
OUTRO = (12.9, 'مُذَاكِر. رَفِيقُكَ الجَامِعِي.')

# ——— موسيقى بنمط الترند: بداية هادئة، بناء، ثم «دروب» عند ظهور النتيجة ———
# 120 نبضة/دقيقة: المازورة ثانيتان، والشبكة تبدأ من 0.9 ث حتى تقع المازورات على لحظات المقطع:
# 2.9 دخول الجوال · 6.9 ظهور النتيجة (الدروب) · 12.9 الشعار
from scipy import signal as sg
def midi(n): return 440.0 * 2 ** ((n - 69) / 12)
BPM = 120; BEAT = 60 / BPM; BAR = BEAT * 4; GRID0 = 0.9
DROP = 6.9; BUILD = 2.9; OUT = 12.9
# Am → F → C → G (تقدّم بوب متفائل)
CHORDS = [[57, 60, 64], [53, 57, 60], [48, 52, 55], [55, 59, 62]]

def env(n, a, d):
    tt = np.arange(n) / SR
    return np.minimum(1, tt / max(a, 1e-4)) * np.exp(-tt / d)

def bp(x, lo, hi, order=2): return sg.sosfilt(sg.butter(order, [lo, hi], 'band', fs=SR, output='sos'), x)
def hp(x, f, order=2): return sg.sosfilt(sg.butter(order, f, 'high', fs=SR, output='sos'), x)
def lp(x, f, order=2): return sg.sosfilt(sg.butter(order, f, 'low', fs=SR, output='sos'), x)

def add(buf, x, at, g=1.0):
    s = int(at * SR)
    if s >= N: return
    e = min(N, s + len(x)); buf[s:e] += x[:e - s] * g

def kick():
    n = int(0.45 * SR); tt = np.arange(n) / SR
    f = 45 + 110 * np.exp(-tt * 28)
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-tt * 7) + 0.3 * np.exp(-tt * 400) * rng.standard_normal(n)

def clap():
    n = int(0.25 * SR); x = np.zeros(n); noise = rng.standard_normal(n)
    for k, off in enumerate((0, 0.011, 0.022)):
        s = int(off * SR); m = n - s; x[s:] += noise[:m] * np.exp(-np.arange(m) / SR * (120 if k < 2 else 18))
    return bp(x, 900, 3500) * 1.6

def hat(open_=False):
    n = int((0.22 if open_ else 0.05) * SR)
    return hp(rng.standard_normal(n), 7000) * np.exp(-np.arange(n) / SR * (14 if open_ else 70))

def sub(note, dur):
    n = int(dur * SR); tt = np.arange(n) / SR; f = midi(note - 24)
    return np.tanh(2.2 * np.sin(2 * np.pi * f * tt)) * np.minimum(1, tt / 0.01) * np.exp(-tt * 1.1) * 0.55

def ep(note, dur=1.0):  # بيانو كهربائي ناعم
    n = int(dur * SR); tt = np.arange(n) / SR; f = midi(note)
    return np.sin(2 * np.pi * f * tt + 0.9 * np.sin(2 * np.pi * f * 2 * tt) * np.exp(-tt * 5)) * env(n, 0.003, 0.35)

def pad_chord(ch, dur):
    n = int(dur * SR); tt = np.arange(n) / SR; x = np.zeros(n)
    for note in ch:
        for det in (-0.1, 0.1):
            f = midi(note) * 2 ** (det / 12); x += np.sign(np.sin(2 * np.pi * f * tt)) * 0.3 + np.sin(2 * np.pi * f * tt)
    a = int(0.3 * SR); r = int(0.4 * SR); e = np.ones(n); e[:a] = np.linspace(0, 1, a); e[-r:] *= np.linspace(1, 0, r)
    return lp(x * e, 1400) / len(ch)

def riser(dur):
    n = int(dur * SR); tt = np.arange(n) / SR
    noise = rng.standard_normal(n); out = np.zeros(n); seg = int(0.05 * SR)
    for i in range(0, n, seg):  # مرشح يفتح تدريجياً
        fc = 500 + 7000 * (i / n) ** 2; out[i:i + seg] = bp(noise[i:i + seg + 2000], fc * 0.7, min(fc * 1.3, 20000))[:len(out[i:i + seg])]
    sweep = np.sin(2 * np.pi * np.cumsum(200 + 900 * (tt / dur) ** 2) / SR) * 0.25
    return (out / (np.max(np.abs(out)) + 1e-9) + sweep) * (tt / dur) ** 2

def music():
    drums = np.zeros(N); bass = np.zeros(N); keys = np.zeros(N); padb = np.zeros(N); fxb = np.zeros(N)
    pump = np.ones(N)  # «ضخ» الوسادة مع الطبل
    bars = [GRID0 + i * BAR for i in range(-1, 8)]
    for bi, t0 in enumerate(bars):
        ch = CHORDS[bi % 4]
        if t0 + BAR <= 0 or t0 >= OUT + 0.01: continue
        if t0 >= 0:
            add(padb, pad_chord(ch, BAR + 0.3), t0, 0.3 if t0 < DROP else 0.75)
        for k in range(8):  # نقرات على الثُمن
            tk = t0 + k * BEAT / 2
            if 0 <= tk < OUT:
                note = [ch[0] + 12, ch[2] + 12, ch[1] + 12, ch[2] + 12, ch[0] + 24, ch[2] + 12, ch[1] + 12, ch[2] + 12][k]
                add(keys, ep(note), tk, (0.13 if tk < DROP else 0.3) * (0.8 + 0.4 * rng.random()))
        for b in range(4):
            tb = t0 + b * BEAT
            if tb < 0 or tb >= OUT: continue
            if tb >= BUILD:  # بعد دخول الجوال: طبل خفيف
                full = tb >= DROP
                if full or b % 2 == 0: add(drums, kick(), tb, 1.0 if full else 0.35)
                if full:
                    kk = int(tb * SR); m = min(N - kk, int(0.35 * SR))
                    pump[kk:kk + m] = np.minimum(pump[kk:kk + m], 1 - 0.55 * np.exp(-np.arange(m) / SR * 9))
                if full and b in (1, 3): add(drums, clap(), tb, 0.55)
                for h in range(2):
                    th = tb + h * BEAT / 2
                    add(drums, hat(open_=(full and h == 1 and b == 3)), th, 0.18 if full else 0.05)
                if full and b == 3:  # رفّة هاي هات سريعة
                    for r in range(4): add(drums, hat(), tb + BEAT / 2 + r * BEAT / 8, 0.07)
            if tb >= DROP and b in (0, 2): add(bass, sub(ch[0], BEAT * 2), tb, 1.0)
    # ريزر قبل الدروب + لحظة صمت قصيرة (حركة ترند مشهورة)
    add(fxb, riser(DROP - 0.15 - 4.9), 4.9, 0.22)
    gap = slice(int((DROP - 0.16) * SR), int(DROP * SR))
    for b_ in (drums, keys, padb, bass): b_[gap] *= 0.0
    # ضربة الدروب: كيك + صنج منخفض
    crash = hp(rng.standard_normal(int(1.6 * SR)), 4000) * np.exp(-np.arange(int(1.6 * SR)) / SR * 2.5)
    add(fxb, crash, DROP, 0.10); add(fxb, kick(), DROP, 0.5)
    # الختام: رنّة الشعار ووسادة تذوب
    n = int(2.8 * SR); tt = np.arange(n) / SR; bell = np.zeros(n)
    for f, g in ((midi(84), 1), (midi(88), .55), (midi(91), .45), (midi(96), .3)):
        bell += np.sin(2 * np.pi * f * tt) * np.exp(-tt * 2.2) * g
    add(fxb, bell / np.max(np.abs(bell)), OUT, 0.2)
    add(padb, pad_chord([57, 60, 64, 69], 3.1), OUT, 0.55)
    # انزلاق مع دخول الجوال
    add(fxb, riser(0.6)[::-1] * np.hanning(int(0.6 * SR)), BUILD, 0.16)
    # صدى على النقرات
    d = int(BEAT * 0.75 * SR); wet = np.zeros(N)
    for k, g in enumerate((0.3, 0.15), 1): wet[k * d:] += keys[:N - k * d] * g
    keys = lp(keys + wet, 5000)
    # فلتر يفتح تدريجياً في المقدمة
    intro = np.ones(N); ie = int(BUILD * SR); intro[:ie] = 0.55 + 0.45 * np.linspace(0, 1, ie) ** 2
    m = drums + bass + (keys + padb * pump) * intro + fxb
    m = np.tanh(m * 1.2) / 1.2  # تشبع خفيف يعطي دفئاً
    fade = np.ones(N); fi = int(0.05 * SR); fo = int(0.6 * SR); fade[:fi] = np.linspace(0, 1, fi); fade[-fo:] = np.linspace(1, 0, fo)
    m *= fade
    return m / (np.max(np.abs(m)) + 1e-9)

def polish(x):
    """معالجة التعليق: قص الترددات المنخفضة، تقليل الغُنّة، إبراز الوضوح، ضغط ديناميكي، ولمسة غرفة."""
    sr = SR
    x = hp(x, 90, 4)
    def peq(x, f0, gain_db, q):
        A = 10 ** (gain_db / 40); w = 2 * np.pi * f0 / sr; al = np.sin(w) / (2 * q)
        b = [1 + al * A, -2 * np.cos(w), 1 - al * A]; a = [1 + al / A, -2 * np.cos(w), 1 - al / A]
        return sg.lfilter(b, a, x)
    x = peq(x, 160, 2.0, 0.8)    # دفء
    x = peq(x, 380, -3.0, 1.2)   # أقل «صندوقية»
    x = peq(x, 3200, 3.5, 0.9)   # وضوح
    x = peq(x, 7000, -2.5, 2.0)  # تخفيف السين
    # ضاغط بسيط
    envl = np.sqrt(sg.lfilter([0.002], [1, -0.998], x ** 2) + 1e-12)
    thr = 0.18; ratio = 3.0
    gain = np.where(envl > thr, (thr * (envl / thr) ** (1 / ratio)) / envl, 1.0)
    x = x * gain
    # غرفة قصيرة جداً
    room = np.zeros_like(x)
    for dms, g in ((23, 0.10), (41, 0.07), (67, 0.045)):
        k = int(dms / 1000 * sr); room[k:] += x[:-k] * g
    x = x + lp(room, 4000)
    return x / (np.max(np.abs(x)) + 1e-9)

# ——— تعليق صوتي ———
def make_tts(model_dir):
    import sherpa_onnx
    M = os.path.join(model_dir, 'ar_JO-kareem-medium')
    cfg = sherpa_onnx.OfflineTtsConfig(model=sherpa_onnx.OfflineTtsModelConfig(vits=sherpa_onnx.OfflineTtsVitsModelConfig(
        model=M + '.onnx', tokens=os.path.join(model_dir, 'tokens.txt'), data_dir=os.path.join(model_dir, 'espeak-ng-data'),
        noise_scale=0.5, noise_scale_w=0.6), num_threads=4))  # أوضح إعداد حسب اختبار التعرّف على الكلام
    tts = sherpa_onnx.OfflineTts(cfg)
    def say(text):
        a = tts.generate(text, sid=0, speed=1.08)
        x = np.asarray(a.samples, dtype=np.float64)
        # تحويل 22050 → 44100 بالاستيفاء الخطي
        x = np.interp(np.arange(0, len(x), a.sample_rate / SR), np.arange(len(x)), x)
        return polish(x / (np.max(np.abs(x)) + 1e-9))
    return say

def main():
    model_dir, out_dir = sys.argv[1], sys.argv[2]; with_voice = '--no-voice' not in sys.argv
    os.makedirs(out_dir, exist_ok=True)
    bg = music()
    say = make_tts(model_dir) if with_voice else None
    for vid, lines in SCRIPTS.items():
        voice = np.zeros(N); mask = np.zeros(N)
        if say:
            free = 0.0  # لا يبدأ سطر قبل أن ينتهي السابق
            for at, text in lines + [OUTRO]:
                x = say(text); at = max(at, free + 0.2); free = at + len(x) / SR
                s = int(at * SR); e = min(N, s + len(x))
                voice[s:e] += x[:e - s]; mask[s:e] = 1
                if s + len(x) > N: print(f'  تنبيه: {vid} "{text[:20]}" يتجاوز نهاية المقطع')
        # خفض الموسيقى أثناء الكلام بنعومة
        k = int(0.25 * SR); duck = np.convolve(mask, np.ones(k) / k, mode='same')
        music_gain = 0.30 * (1 - 0.5 * duck) if say else 0.45 * np.ones(N)
        mix = bg * music_gain + voice * 0.8
        mix /= max(1.0, np.max(np.abs(mix)) / 0.95)
        path = os.path.join(out_dir, vid + ('.wav' if say else '-music.wav'))
        sf.write(path, np.stack([mix, mix], 1).astype(np.float32), SR)
        print(path)

if __name__ == '__main__':
    main()
