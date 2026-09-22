import { router } from 'expo-router';
import { View } from 'react-native';
import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { IconBadge } from '@/components/IconBadge';
import { Screen, SectionHeader } from '@/components/Screen';
import { DAY_SHORT, formatDuration } from '@/lib/dates';
import { lastWeek, minutesByCourse, streak } from '@/lib/stats';
import { useNow } from '@/lib/useNow';
import { isPro, useStore } from '@/store/useStore';
import { spacing, useTheme } from '@/theme';

function Metric({ icon, color, label, value }: { icon: 'flame' | 'time' | 'checkmark-done' | 'albums'; color: string; label: string; value: string }) {
  return (
    <Card style={{ flexBasis: '47%', flexGrow: 1, gap: spacing.sm }}>
      <IconBadge name={icon} color={color} size={38} />
      <AppText variant="h2">{value}</AppText>
      <AppText variant="caption" muted>
        {label}
      </AppText>
    </Card>
  );
}

export default function Stats() {
  const { colors } = useTheme();
  const sessions = useStore((s) => s.sessions);
  const tasks = useStore((s) => s.tasks);
  const courses = useStore((s) => s.courses);
  const decks = useStore((s) => s.decks);
  const goal = useStore((s) => s.settings.dailyGoalMin);
  const pro = useStore((s) => isPro(s.subscription));
  const now = useNow();

  const week = lastWeek(sessions, new Date(now));
  const weekTotal = week.reduce((a, d) => a + d.minutes, 0);
  const max = Math.max(goal, ...week.map((d) => d.minutes));
  const byCourse = [...minutesByCourse(sessions, 30, new Date(now)).entries()].sort((a, b) => b[1] - a[1]);
  const monthTotal = byCourse.reduce((a, [, m]) => a + m, 0);
  const doneWeek = tasks.filter((t) => t.done && t.doneAt && now - t.doneAt < 7 * 86_400_000).length;
  const cards = decks.reduce((a, d) => a + d.cards.length, 0);
  const goalDays = week.filter((d) => d.minutes >= goal).length;

  return (
    <Screen back title="الإحصائيات" subtitle="آخر 7 أيام">
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md }}>
        <Metric icon="time" color="#4F46E5" label="مذاكرة هذا الأسبوع" value={formatDuration(weekTotal)} />
        <Metric icon="flame" color="#F97316" label="أيام متتالية" value={String(streak(sessions, new Date(now)))} />
        <Metric icon="checkmark-done" color="#10B981" label="مهام أُنجزت هذا الأسبوع" value={String(doneWeek)} />
        <Metric icon="albums" color="#0EA5E9" label="بطاقات مراجعة" value={String(cards)} />
      </View>

      <SectionHeader title="المذاكرة اليومية" />
      <Card style={{ gap: spacing.md }}>
        <AppText variant="caption" muted>
          حققت هدفك اليومي ({formatDuration(goal)}) في {goalDays} من 7 أيام
        </AppText>
        <View style={{ flexDirection: 'row', alignItems: 'flex-end', height: 160, gap: 8 }} accessibilityLabel={`رسم بياني: ${week.map((d) => `${DAY_SHORT[d.date.getDay()]} ${d.minutes} دقيقة`).join('، ')}`}>
          {week.map((d, i) => {
            const h = Math.max(4, (d.minutes / max) * 130);
            const today = i === week.length - 1;
            const hit = d.minutes >= goal;
            return (
              <View key={i} style={{ flex: 1, alignItems: 'center', gap: 6 }}>
                <AppText variant="tiny" muted>
                  {d.minutes ? Math.round(d.minutes) : ''}
                </AppText>
                <View style={{ width: '70%', height: h, borderRadius: 6, backgroundColor: hit ? colors.success : today ? colors.primary : colors.primary + '55' }} />
                <AppText variant="tiny" color={today ? colors.primary : colors.textMuted}>
                  {DAY_SHORT[d.date.getDay()]}
                </AppText>
              </View>
            );
          })}
        </View>
        <View style={{ flexDirection: 'row', gap: spacing.lg }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <View style={{ width: 10, height: 10, borderRadius: 3, backgroundColor: colors.success }} />
            <AppText variant="tiny" muted>
              حققت الهدف
            </AppText>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <View style={{ width: 10, height: 10, borderRadius: 3, backgroundColor: colors.primary + '55' }} />
            <AppText variant="tiny" muted>
              دون الهدف (بالدقائق)
            </AppText>
          </View>
        </View>
      </Card>

      <SectionHeader title="توزيع المذاكرة (30 يوماً)" />
      <Card style={{ gap: spacing.md }}>
        {!pro ? (
          <View style={{ alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.md }}>
            <AppText variant="h3">تحليل المقررات متاح في برو</AppText>
            <AppText variant="caption" muted center>
              اعرف أين يذهب وقتك وأي مقرر يحتاج اهتماماً أكثر.
            </AppText>
            <Button title="اكتشف برو" icon="diamond" size="sm" onPress={() => router.push('/pro')} />
          </View>
        ) : byCourse.length === 0 ? (
          <AppText variant="caption" muted center>
            ابدأ أول جلسة مذاكرة لتظهر إحصائياتك هنا.
          </AppText>
        ) : (
          byCourse.map(([cid, m]) => {
            const c = courses.find((x) => x.id === cid);
            const pct = monthTotal ? m / monthTotal : 0;
            return (
              <View key={cid ?? 'general'} style={{ gap: 6 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <AppText variant="label">{c?.name ?? 'مذاكرة عامة'}</AppText>
                  <AppText variant="caption" muted>
                    {formatDuration(m)} · {Math.round(pct * 100)}%
                  </AppText>
                </View>
                <View style={{ height: 8, borderRadius: 4, backgroundColor: colors.surfaceAlt, overflow: 'hidden' }}>
                  <View style={{ width: `${pct * 100}%`, height: '100%', borderRadius: 4, backgroundColor: c?.color ?? colors.primary }} />
                </View>
              </View>
            );
          })
        )}
      </Card>
    </Screen>
  );
}
