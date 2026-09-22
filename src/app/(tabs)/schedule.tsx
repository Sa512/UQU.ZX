import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { AppText } from '@/components/AppText';
import { Card } from '@/components/Card';
import { EmptyState } from '@/components/EmptyState';
import { haptic } from '@/components/haptics';
import { SlotRow } from '@/components/Rows';
import { HeaderButton, Screen } from '@/components/Screen';
import { DAY_NAMES, DAY_SHORT, formatDuration } from '@/lib/dates';
import { ar, COURSES, SLOTS } from '@/lib/plural';
import { useNow } from '@/lib/useNow';
import { useStore } from '@/store/useStore';
import { radius, spacing, useTheme } from '@/theme';

export default function Schedule() {
  const { colors } = useTheme();
  const slots = useStore((s) => s.slots);
  const courses = useStore((s) => s.courses);
  const now = new Date(useNow());
  const today = now.getDay();
  const [day, setDay] = useState(today);
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const list = slots.filter((s) => s.day === day).sort((a, b) => a.start - b.start);
  const total = list.reduce((a, s) => a + (s.end - s.start), 0);
  const current = day === today ? list.find((s) => s.start <= nowMin && s.end > nowMin) : undefined;
  const next = day === today ? list.find((s) => s.start > nowMin) : undefined;

  const add = () => {
    if (!courses.length) router.push('/course/new');
    else router.push({ pathname: '/slot/new', params: { day: String(day) } });
  };

  return (
    <Screen
      inTabs
      title="الجدول الدراسي"
      subtitle={`${ar(courses.length, COURSES)} · ${ar(slots.length, SLOTS)} أسبوعياً`}
      right={
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <HeaderButton icon="library-outline" label="المقررات" onPress={() => router.push('/courses')} />
          <HeaderButton icon="add" label="إضافة حصة" onPress={add} />
        </View>
      }
    >
      <View style={{ flexDirection: 'row', gap: 6 }}>
        {DAY_SHORT.map((d, i) => {
          const active = i === day;
          const has = slots.some((s) => s.day === i);
          return (
            <Pressable
              key={d}
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
              accessibilityLabel={DAY_NAMES[i]}
              onPress={() => {
                haptic.tap();
                setDay(i);
              }}
              style={{
                flex: 1,
                paddingVertical: 10,
                borderRadius: radius.md,
                alignItems: 'center',
                gap: 4,
                backgroundColor: active ? colors.fill : colors.surface,
                borderWidth: 1,
                borderColor: active ? colors.fill : i === today ? colors.primary + '66' : colors.border,
              }}
            >
              <AppText variant="tiny" color={active ? '#FFFFFF' : colors.text} numberOfLines={1}>
                {d}
              </AppText>
              <View style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: has ? (active ? '#FFFFFF' : colors.primary) : 'transparent' }} />
            </Pressable>
          );
        })}
      </View>

      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <AppText variant="h2">
          {DAY_NAMES[day]}
          {day === today ? ' (اليوم)' : ''}
        </AppText>
        {list.length > 0 && (
          <AppText variant="caption" muted>
            {ar(list.length, SLOTS)} · {formatDuration(total)}
          </AppText>
        )}
      </View>

      {list.length === 0 ? (
        <Card padded={false}>
          <EmptyState
            icon="calendar-clear-outline"
            title={courses.length ? 'لا حصص في هذا اليوم' : 'ابدأ بإضافة مقرراتك'}
            message={courses.length ? 'أضف محاضرة أو معملاً أو ساعة مكتبية.' : 'أضف مقرراً أولاً ثم رتّب مواعيد محاضراته.'}
            action={{ title: courses.length ? 'إضافة حصة' : 'إضافة مقرر', onPress: add }}
          />
        </Card>
      ) : (
        <View style={{ gap: spacing.sm }}>
          {list.map((s) => (
            <SlotRow key={s.id} slot={s} highlight={s === current ? 'now' : s === next ? 'next' : undefined} />
          ))}
        </View>
      )}
    </Screen>
  );
}
