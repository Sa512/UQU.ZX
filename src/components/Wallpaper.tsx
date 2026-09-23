import { LinearGradient } from 'expo-linear-gradient';
import { forwardRef } from 'react';
import { View } from 'react-native';
import { DAY_NAMES, formatMinutes } from '@/lib/dates';
import type { Course, Section, Slot } from '@/store/useStore';
import { fonts } from '@/theme';
import { AppText } from './AppText';

export type WallTheme = 'violet' | 'midnight' | 'light';
export type WallContent = 'week' | 'office';

const THEMES: Record<WallTheme, { bg: [string, string]; card: string; text: string; muted: string; line: string }> = {
  violet: { bg: ['#7C3AED', '#3730A3'], card: 'rgba(255,255,255,0.14)', text: '#FFFFFF', muted: 'rgba(255,255,255,0.72)', line: 'rgba(255,255,255,0.18)' },
  midnight: { bg: ['#0B1020', '#1C2440'], card: 'rgba(255,255,255,0.07)', text: '#F1F5F9', muted: '#A3AEC6', line: 'rgba(255,255,255,0.1)' },
  light: { bg: ['#F5F6FB', '#E0E7FF'], card: '#FFFFFF', text: '#0F172A', muted: '#5B6478', line: '#E3E6F0' },
};

type Props = {
  width: number;
  theme: WallTheme;
  content: WallContent;
  slots: Slot[];
  courses: Course[];
  sections: Section[];
  title: string;
};

/** تصميم الخلفية بنسبة شاشة الجوال (9:19.5). الأبعاد محسوبة من العرض ليطابق الحفظ المعاينة. */
export const Wallpaper = forwardRef<View, Props>(function Wallpaper({ width, theme, content, slots, courses, sections, title }, ref) {
  const t = THEMES[theme];
  const k = width / 390;
  const height = width * (2796 / 1290);
  const list = slots.filter((s) => (content === 'office' ? s.type === 'office' : true)).sort((a, b) => a.day - b.day || a.start - b.start);
  const days = [...new Set(list.map((s) => s.day))];
  const dense = list.length > 14;
  const fs = (n: number) => n * k * (dense ? 0.86 : 1);
  const label = (s: Slot) => {
    const c = courses.find((x) => x.id === s.courseId);
    if (s.type === 'office') return 'ساعات مكتبية';
    const sec = s.sectionId ? sections.find((x) => x.id === s.sectionId) : undefined;
    return `${c?.code || c?.name || '—'}${sec ? ` · ${sec.code}` : ''}`;
  };
  const dot = (s: Slot) => (s.type === 'office' ? '#2DD4BF' : (courses.find((x) => x.id === s.courseId)?.color ?? '#818CF8'));

  return (
    <View ref={ref} collapsable={false} style={{ width, height, overflow: 'hidden' }}>
      <LinearGradient colors={t.bg} start={{ x: 1, y: 0 }} end={{ x: 0, y: 1 }} style={{ flex: 1, paddingHorizontal: 22 * k, paddingTop: height * 0.34, paddingBottom: 60 * k }}>
        <AppText style={{ fontFamily: fonts.bold, fontSize: fs(20), lineHeight: fs(30), color: t.text, marginBottom: 10 * k }}>{title}</AppText>
        {days.length === 0 ? (
          <AppText style={{ fontSize: fs(14), color: t.muted }}>{content === 'office' ? 'لا توجد ساعات مكتبية بعد' : 'جدولك فارغ — أضف محاضراتك أولاً'}</AppText>
        ) : (
          <View style={{ backgroundColor: t.card, borderRadius: 22 * k, paddingVertical: 6 * k, paddingHorizontal: 14 * k }}>
            {days.map((d, i) => (
              <View key={d} style={{ flexDirection: 'row', gap: 10 * k, paddingVertical: (dense ? 6 : 9) * k, borderTopWidth: i ? 1 : 0, borderTopColor: t.line }}>
                <AppText style={{ width: 62 * k, fontFamily: fonts.bold, fontSize: fs(13), lineHeight: fs(20), color: t.text }}>{DAY_NAMES[d]}</AppText>
                <View style={{ flex: 1, gap: 3 * k }}>
                  {list
                    .filter((s) => s.day === d)
                    .map((s) => (
                      <View key={s.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 * k }}>
                        <View style={{ width: 8 * k, height: 8 * k, borderRadius: 4 * k, backgroundColor: dot(s), borderWidth: 1.2 * k, borderColor: t.text }} />
                        <AppText style={{ fontFamily: fonts.semibold, fontSize: fs(12.5), lineHeight: fs(19), color: t.text }}>{formatMinutes(s.start)}</AppText>
                        <AppText numberOfLines={1} style={{ flex: 1, fontSize: fs(12.5), lineHeight: fs(19), color: t.text }}>
                          {label(s)}
                          {s.room ? <AppText style={{ fontSize: fs(11.5), color: t.muted }}>{`  ${s.room}`}</AppText> : null}
                        </AppText>
                      </View>
                    ))}
                </View>
              </View>
            ))}
          </View>
        )}
        <AppText style={{ position: 'absolute', bottom: 34 * k, alignSelf: 'center', fontSize: fs(11), color: t.muted }}>مذاكر</AppText>
      </LinearGradient>
    </View>
  );
});
