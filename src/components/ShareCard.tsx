import { LinearGradient } from 'expo-linear-gradient';
import { forwardRef } from 'react';
import { Image, Text, View, type TextStyle } from 'react-native';
import { APP_INFO } from '@/content/app';
import type { CardTone, ShareCardData } from '@/lib/shareCards';
import { fonts } from '@/theme';

const TONES: Record<CardTone, { bg: [string, string, string]; accent: string }> = {
  violet: { bg: ['#7C3AED', '#4F46E5', '#312E81'], accent: '#FCD34D' },
  emerald: { bg: ['#059669', '#0F766E', '#134E4A'], accent: '#FDE68A' },
  rose: { bg: ['#E11D48', '#BE185D', '#831843'], accent: '#FDE68A' },
  amber: { bg: ['#D97706', '#C2410C', '#7C2D12'], accent: '#FEF3C7' },
  midnight: { bg: ['#1E1B4B', '#0F172A', '#020617'], accent: '#FCD34D' },
  sky: { bg: ['#0284C7', '#1D4ED8', '#1E3A8A'], accent: '#FDE68A' },
};

const ICON = require('../../assets/icon.png');
const SITE = APP_INFO.siteUrl.replace(/^https?:\/\//, '');

/** حجم الرقم الكبير حسب طوله حتى لا يلتف. */
function bigSize(big: string): number {
  const n = [...big].length;
  return n <= 2 ? 150 : n <= 4 ? 118 : n <= 6 ? 76 : 56;
}

/**
 * بطاقة ستوري بنسبة 9:16. كل الأبعاد تُحسب من العرض، فالمعاينة الصغيرة والصورة المحفوظة (1080×1920) متطابقتان.
 * الثلث العلوي خفيف عمداً لأن واجهة الستوري في سناب وإنستقرام تغطيه.
 */
export const ShareCard = forwardRef<View, { data: ShareCardData; width: number }>(function ShareCard({ data, width }, ref) {
  const k = width / 360;
  const t = TONES[data.tone];
  const txt = (size: number, weight: keyof typeof fonts, color = '#FFFFFF', extra?: TextStyle): TextStyle => ({
    fontFamily: fonts[weight],
    fontSize: size * k,
    lineHeight: size * k * 1.35,
    color,
    textAlign: 'center',
    ...extra,
  });
  const bs = bigSize(data.big);

  return (
    <View ref={ref} collapsable={false} style={{ width, height: (width * 16) / 9, overflow: 'hidden' }}>
      <LinearGradient colors={t.bg} start={{ x: 0.1, y: 0 }} end={{ x: 0.9, y: 1 }} style={{ flex: 1, paddingHorizontal: 28 * k }}>
        {/* زخارف */}
        <View style={{ position: 'absolute', width: 300 * k, height: 300 * k, borderRadius: 150 * k, backgroundColor: 'rgba(255,255,255,0.08)', top: -90 * k, left: -110 * k }} />
        <View style={{ position: 'absolute', width: 240 * k, height: 240 * k, borderRadius: 120 * k, backgroundColor: 'rgba(255,255,255,0.06)', bottom: 90 * k, right: -120 * k }} />

        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: 70 * k, gap: 10 * k }}>
          <View style={{ backgroundColor: 'rgba(255,255,255,0.16)', borderRadius: 999, paddingHorizontal: 16 * k, paddingVertical: 6 * k, maxWidth: '100%' }}>
            <Text numberOfLines={1} style={txt(14, 'semibold')}>
              {data.eyebrow}
            </Text>
          </View>

          <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'center', gap: 8 * k, marginTop: 8 * k }}>
            <Text style={txt(bs, 'bold', '#FFFFFF', { lineHeight: bs * k * 1.15, textShadowColor: 'rgba(0,0,0,0.18)', textShadowOffset: { width: 0, height: 4 * k }, textShadowRadius: 12 * k })}>{data.big}</Text>
            {data.suffix ? <Text numberOfLines={1} style={txt(24, 'semibold', 'rgba(255,255,255,0.85)', { flexShrink: 0 })}>{data.suffix}</Text> : null}
          </View>

          <Text style={txt(28, 'bold')}>{data.title}</Text>
          {data.sub ? (
            <View style={{ backgroundColor: t.accent, borderRadius: 14 * k, paddingHorizontal: 14 * k, paddingVertical: 4 * k, marginTop: 6 * k, transform: [{ rotate: '-2deg' }] }}>
              <Text style={txt(17, 'bold', '#1E1B4B')}>{data.sub}</Text>
            </View>
          ) : null}

          {data.lines?.length ? (
            <View style={{ alignSelf: 'stretch', marginTop: 18 * k, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 20 * k, padding: 16 * k, gap: 10 * k }}>
              {data.lines.map((l) => (
                <View key={l.label} style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 12 * k }}>
                  <Text style={txt(15, 'regular', 'rgba(255,255,255,0.8)', { textAlign: 'left' })}>{l.label}</Text>
                  <Text numberOfLines={1} style={txt(15, 'bold', '#FFFFFF', { flexShrink: 1, textAlign: 'right' })}>
                    {l.value}
                  </Text>
                </View>
              ))}
            </View>
          ) : null}
        </View>

        {/* توقيع التطبيق: يحوّل كل مشاركة إلى دعوة */}
        <View style={{ alignItems: 'center', paddingBottom: 34 * k, gap: 6 * k }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 * k }}>
            <Image source={ICON} style={{ width: 40 * k, height: 40 * k, borderRadius: 11 * k }} />
            <View>
              <Text style={txt(20, 'bold', '#FFFFFF', { textAlign: 'left', lineHeight: 24 * k })}>{APP_INFO.name}</Text>
              <Text style={txt(11, 'medium', 'rgba(255,255,255,0.75)', { textAlign: 'left', lineHeight: 15 * k })}>رفيقك الجامعي</Text>
            </View>
          </View>
          <Text style={txt(11, 'medium', 'rgba(255,255,255,0.65)', { writingDirection: 'ltr' })}>{SITE}</Text>
        </View>
      </LinearGradient>
    </View>
  );
});
