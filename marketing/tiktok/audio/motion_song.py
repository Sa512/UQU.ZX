"""نسخة «أغنية + تعليق» لمقطع الموشن (72 ث):
- الأغنية: طبول motion_music.py + كوردات سنث بمقام الحجاز تضخ مع الطبل + لازمة مغنّاة «مُذَاكِر… رَفِيقَك الجَامِعِي»
  (صوت مولّد ثم «أوتوتيون» حاد على مقام الحجاز، نفس أسلوب الترندات) عند الدروبات.
- التعليق: صوت شاب حماسي سريع (YNG) يقرأ كل ميزة على إيقاعها، والموسيقى تنخفض تحته بنعومة.
كل شيء مولّد هنا بلا عينات خارجية، فلا حقوق لطرف ثالث.
الاستخدام: python motion_song.py <مجلد نموذج kareem> <ملف الإخراج.wav>
"""
import sys, numpy as np, soundfile as sf
import mix
from mix import SR, BEAT, BAR, midi, supersaw, lp, hp, env, make_tts, trim, polish, VOICES
import motion_music as mm

N = mm.N; add = mm.add

# التعليق: (الوقت، النص). الأسطر لا تتداخل: السطر يبدأ بعد انتهاء السابق.
VO = [
    (0.05, 'طَالِب؟'), (0.55, 'أَوْ دُكْتُور؟'),
    (1.1, 'جَدْوَلَك صُورَة، وَالوَاجِبَات ضَايْعَة، وَكَمْ بَاقِي لَكَ غِيَاب؟'),
    (6.1, 'كُلّ هَذَا… فِي تَطْبِيقٍ وَاحِد!'),
    (10.05, 'لِلطَّالِب!'),
    (12.05, 'يَوْمَك كُلُّه بِنَظْرَة.'), (14.05, 'جَدْوَلَك.'), (16.05, 'وَاجِبَاتَك.'), (18.05, 'بْلَاك بُورْد يِدْخُل لِحَالُه.'),
    (20.05, 'كَمْ تَحْتَاج فِي الفَايْنَل؟'), (22.05, 'غِيَابَك.'), (24.05, 'مُعَدَّلَك.'), (26.05, 'جَلَسَات تَرْكِيز.'),
    (28.05, 'بِطَاقَات مُرَاجَعَة.'), (30.05, 'خُطَّة مُذَاكَرَة.'), (32.05, 'إِعْلَان الدُّكْتُور فَوْرًا.'),
    (34.05, 'شَارِك نَتِيجَتَك.'), (36.05, 'وَمُلَخَّص فَصْلَك.'),
    (38.1, 'وَلِلدُّكْتُور… نَصِيبٌ كَبِير!'),
    (40.05, 'لِلدُّكْتُور!'),
    (42.05, 'جَدْوَلَك مِنْ إِكْسِل.'), (44.05, 'شُعَبَك وَطُلَّابَك.'), (46.05, 'تَحْضِير بْكِيُو آر.'), (48.05, 'رَصْد الدَّرَجَات.'),
    (50.05, 'السَّاعَات المَكْتَبِيَّة.'), (52.05, 'قَنَاة الشُّعْبَة.'), (54.05, 'وَخَلْفِيَّة جَوَّالَك.'),
    (60.1, 'بَيَانَاتَك عَلَى جَوَّالَك.'), (61.05, 'بِدُون كَلِمَة مُرُور الجَامِعَة.'),
    (62.5, 'جَاهِز؟'),
    (67.1, 'قَرِيبًا! تَابِعْنَا عَشَان يُوصَلَك أَوَّل.'),
]
# اللازمة المغنّاة: (الوقت، النص)
HOOKS = [(8.05, 'مُذَاكِر. رَفِيقَك الجَامِعِي.'), (56.05, 'مُذَاكِر. رَفِيقَك الجَامِعِي.'), (64.05, 'مُذَاكِر. رَفِيقَك الجَامِعِي.')]

HIJAZ_PC = {2, 3, 6, 7, 9, 10, 0}  # ري مي♭ فا# صول لا سي♭ دو


def autotune(x, sr, shift=7.0, expr=1.7):
    """أوتوتيون حاد: يرفع الطبقة ويوسّع اللحن ثم يلصق كل إطار بأقرب نغمة في مقام الحجاز."""
    import pyworld as pw
    x = np.ascontiguousarray(x, dtype=np.float64)
    F0, t = pw.harvest(x, sr, f0_floor=60, f0_ceil=500, frame_period=5.0)
    sp = pw.cheaptrick(x, F0, t, sr); ap = pw.d4c(x, F0, t, sr)
    v = F0 > 0
    if v.any():
        m = 69 + 12 * np.log2(F0[v] / 440); c = np.median(m)
        m = c + shift + expr * (m - c)
        snap = np.array([min((n for n in range(int(k) - 3, int(k) + 4) if n % 12 in HIJAZ_PC), key=lambda n: abs(n - k)) for k in m], float)
        # انزلاق قصير جداً بين النغمات (سرعة ضبط شبه فورية = صوت الترند)
        sm = snap.copy()
        for i in range(1, len(sm)): sm[i] = sm[i - 1] + (snap[i] - sm[i - 1]) * 0.6
        F0 = F0.copy(); F0[v] = 440 * 2 ** ((sm - 69) / 12)
    y = pw.synthesize(F0, sp, ap, sr, frame_period=5.0)
    return y / (np.max(np.abs(y)) + 1e-9)


def sung(tts, text):
    """يولّد اللازمة: كلام أبطأ ← أوتوتيون ← طبقة مضاعفة (أوكتاف أعلى خفيف ونسخة منزاحة) ← صدى."""
    a = tts.generate(text, sid=0, speed=0.82)
    x = np.asarray(a.samples, dtype=np.float64); sr = a.sample_rate
    lead = autotune(x, sr)
    up = autotune(x, sr, shift=19)
    x = np.interp(np.arange(0, len(lead), sr / SR), np.arange(len(lead)), lead)
    u = np.interp(np.arange(0, len(up), sr / SR), np.arange(len(up)), up)
    x = trim(x); u = trim(u)[:len(x)]; u = np.pad(u, (0, len(x) - len(u)))
    dbl = np.concatenate([np.zeros(int(0.018 * SR)), x])[:len(x)]
    y = polish(x + 0.45 * dbl + 0.22 * u)
    wet = np.zeros(len(y) + int(1.2 * SR)); y2 = np.pad(y, (0, len(wet) - len(y)))
    for dms, g in ((375, .28), (750, .14), (61, .12), (113, .09)):
        k = int(dms / 1000 * SR); wet[k:] += y2[:-k] * g
    y = y2 + lp(hp(wet, 300), 5000)
    return y / (np.max(np.abs(y)) + 1e-9)


def chords():
    """كوردات سنث (ري كبير ← مي♭ ← ري ← دو صغير) تضخ مع الطبل في الأقسام الكاملة."""
    buf = np.zeros(N); pump = np.ones(N)
    prog = [[50, 54, 57, 62], [51, 55, 58, 63], [50, 54, 57, 62], [48, 51, 55, 60]]
    for bi in range(int(mm.DUR / BAR)):
        t0 = bi * BAR; s = mm.section(t0)
        if s not in ('full', 'peak') and not (64 <= t0 < 70): continue
        add(buf, supersaw([n + 12 for n in prog[bi % 4]], BAR + 0.05, 2600 if s == 'peak' else 2000), t0, 1.0)
        for b in range(4):
            k = int((t0 + b * BEAT) * SR); m = min(N - k, int(0.35 * SR))
            if m > 0: pump[k:k + m] = np.minimum(pump[k:k + m], 1 - 0.7 * np.exp(-np.arange(m) / SR * 9))
    for a, d in mm.BUILDS: buf[int((d - 0.16) * SR):int(d * SR)] = 0
    return buf * pump


def main():
    model_dir, out = sys.argv[1], sys.argv[2]
    bed = mm.music()  # الطبول والقانون والقرار (مطبّعة)
    bed = bed + 0.5 * chords() / 0.6
    bed /= np.max(np.abs(bed)) + 1e-9
    import sherpa_onnx, os
    VOICES['YNG'] = dict(VOICES['YNG'], speed=1.32)  # أسرع قليلاً لإيقاع الترند
    say = make_tts(model_dir, 'YNG')
    voice = np.zeros(N); mask = np.zeros(N); free = 0.0
    for at, text in VO:
        x = say(text); at = max(at, free + 0.06); free = at + len(x) / SR
        add(voice, x, at); mask[int(at * SR):min(N, int(free * SR))] = 1
        if free > at + 2.2: print(f'  تنبيه: «{text[:24]}» طوله {len(x) / SR:.2f} ث')
    M = os.path.join(model_dir, 'ar_JO-kareem-medium')
    tts = sherpa_onnx.OfflineTts(sherpa_onnx.OfflineTtsConfig(model=sherpa_onnx.OfflineTtsModelConfig(vits=sherpa_onnx.OfflineTtsVitsModelConfig(
        model=M + '.onnx', tokens=os.path.join(model_dir, 'tokens.txt'), data_dir=os.path.join(model_dir, 'espeak-ng-data'),
        noise_scale=0.5, noise_scale_w=0.5), num_threads=4)))
    song = np.zeros(N)
    for at, text in HOOKS:
        y = sung(tts, text); add(song, y, at); print(f'  لازمة {at}: {len(y) / SR - 1.2:.2f} ث'); sf.write(out.replace('.wav', f'-hook{int(at)}.wav'), y, SR)
    k = int(0.25 * SR); duck = np.convolve(mask, np.ones(k) / k, mode='same')
    m = bed * 0.42 * (1 - 0.5 * duck) + song * 0.5 + voice * 0.8
    m /= max(1.0, np.max(np.abs(m)) / 0.95)
    sf.write(out, np.stack([m, m], 1).astype(np.float32), SR)
    print(out)


if __name__ == '__main__':
    main()
