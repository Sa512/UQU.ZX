"""يولّد الصوت لمقاطع تيك توك: تعليق صوتي عربي (Piper عبر sherpa-onnx) + موسيقى هادئة مؤلفة برمجياً + مؤثرات.
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

# ——— موسيقى ———
def midi(n): return 440.0 * 2 ** ((n - 69) / 12)
BPM = 84; BEAT = 60 / BPM; BAR = BEAT * 4
# Fmaj7 → Em7 → Dm7 → Cmaj7 (هادئة ومتفائلة)
CHORDS = [[53, 57, 60, 64], [52, 55, 59, 62], [50, 53, 57, 60], [48, 52, 55, 59]]
t = np.arange(N) / SR

def env_adsr(n, a, r):
    e = np.ones(n); ai = int(a * SR); ri = int(r * SR)
    if ai: e[:ai] = np.linspace(0, 1, ai)
    if ri: e[-ri:] *= np.linspace(1, 0, ri)
    return e

def lowpass(x, cutoff):
    a = np.exp(-2 * np.pi * cutoff / SR); y = np.empty_like(x); acc = 0.0
    for i in range(len(x)): acc = (1 - a) * x[i] + a * acc; y[i] = acc
    return y

def music():
    pad = np.zeros(N); pluck = np.zeros(N); bass = np.zeros(N)
    nbars = int(np.ceil(DUR / BAR))
    for b in range(nbars):
        ch = CHORDS[b % 4]; s = int(b * BAR * SR); e = min(N, int((b + 1) * BAR * SR) + int(0.4 * SR)); n = e - s
        if n <= 0: continue
        tt = np.arange(n) / SR
        for note in ch:  # وسادة ناعمة بنغمتين متقاربتين
            for det in (-0.12, 0.12):
                f = midi(note) * 2 ** (det / 12)
                pad[s:e] += (np.sin(2 * np.pi * f * tt) + 0.25 * np.sin(4 * np.pi * f * tt)) * env_adsr(n, 0.9, 0.9) * 0.05
        bass[s:e] += np.sin(2 * np.pi * midi(ch[0] - 12) * tt) * env_adsr(n, 0.05, 1.2) * np.exp(-tt * 0.5) * 0.16
        # نقرات بيانو كهربائي على الثُمن، صعوداً ونزولاً
        arp = [ch[0] + 12, ch[1] + 12, ch[2] + 12, ch[3] + 12, ch[2] + 12, ch[1] + 12, ch[3] + 12, ch[2] + 12]
        for k, note in enumerate(arp):
            ps = s + int(k * BEAT / 2 * SR); pn = min(int(1.2 * SR), N - ps)
            if pn <= 0: continue
            pt = np.arange(pn) / SR; f = midi(note); vel = 0.07 * (0.75 + 0.5 * rng.random())
            tone = np.sin(2 * np.pi * f * pt + 0.8 * np.sin(2 * np.pi * f * 2 * pt) * np.exp(-pt * 6))
            pluck[ps:ps + pn] += tone * np.exp(-pt * 4.5) * vel * np.minimum(1, pt / 0.004)
    # صدى خفيف على النقرات
    d = int(BEAT * 0.75 * SR); wet = np.zeros(N)
    for k, g in enumerate((0.35, 0.18, 0.09), 1):
        wet[k * d:] += pluck[:N - k * d] * g
    pad = lowpass(pad, 1800)
    m = pad + pluck + wet + bass
    m *= env_adsr(N, 0.6, 1.4)
    return m / (np.max(np.abs(m)) + 1e-9)

# ——— مؤثرات ———
def place(buf, x, at, gain):
    s = int(at * SR); e = min(N, s + len(x)); buf[s:e] += x[:e - s] * gain

def whoosh(dur=0.7):
    n = int(dur * SR); noise = rng.standard_normal(n); tt = np.arange(n) / SR
    cut = 400 + 3500 * np.sin(np.pi * tt / dur) ** 2; out = np.empty(n); acc = 0.0
    for i in range(n):
        a = np.exp(-2 * np.pi * cut[i] / SR); acc = (1 - a) * noise[i] + a * acc; out[i] = acc
    return out * np.sin(np.pi * tt / dur) ** 2 / (np.max(np.abs(out)) + 1e-9)

def pop():
    n = int(0.12 * SR); tt = np.arange(n) / SR; f = 950 * np.exp(-tt * 18) + 280
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-tt * 30)

def chime():
    n = int(1.8 * SR); tt = np.arange(n) / SR; x = np.zeros(n)
    for f, g in ((midi(84), 1), (midi(91), .6), (midi(96), .35)):
        x += np.sin(2 * np.pi * f * tt) * np.exp(-tt * 3) * g
    return x / np.max(np.abs(x))

# ——— تعليق صوتي ———
def make_tts(model_dir):
    import sherpa_onnx
    M = os.path.join(model_dir, 'ar_JO-kareem-medium')
    cfg = sherpa_onnx.OfflineTtsConfig(model=sherpa_onnx.OfflineTtsModelConfig(vits=sherpa_onnx.OfflineTtsVitsModelConfig(
        model=M + '.onnx', tokens=os.path.join(model_dir, 'tokens.txt'), data_dir=os.path.join(model_dir, 'espeak-ng-data')), num_threads=4))
    tts = sherpa_onnx.OfflineTts(cfg)
    def say(text):
        a = tts.generate(text, sid=0, speed=1.08)
        x = np.asarray(a.samples, dtype=np.float64)
        # تحويل 22050 → 44100 بالاستيفاء الخطي
        x = np.interp(np.arange(0, len(x), a.sample_rate / SR), np.arange(len(x)), x)
        return x / (np.max(np.abs(x)) + 1e-9)
    return say

def main():
    model_dir, out_dir = sys.argv[1], sys.argv[2]; with_voice = '--no-voice' not in sys.argv
    os.makedirs(out_dir, exist_ok=True)
    bg = music()
    fx = np.zeros(N)
    place(fx, whoosh(), 2.95, 0.22); place(fx, pop(), 6.95, 0.35); place(fx, whoosh(0.5), 11.9, 0.15); place(fx, chime(), 12.35, 0.18)
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
        music_gain = 0.20 * (1 - 0.55 * duck) if say else 0.30 * np.ones(N)
        mix = bg * music_gain + fx + voice * 0.85
        mix /= max(1.0, np.max(np.abs(mix)) / 0.95)
        path = os.path.join(out_dir, vid + ('.wav' if say else '-music.wav'))
        sf.write(path, np.stack([mix, mix], 1).astype(np.float32), SR)
        print(path)

if __name__ == '__main__':
    main()
