import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router, type Href } from 'expo-router';
import { Pressable, View } from 'react-native';
import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { EmptyState } from '@/components/EmptyState';
import { ProgressRing } from '@/components/ProgressRing';
import { SlotRow, TaskRow } from '@/components/Rows';
import { Screen, SectionHeader } from '@/components/Screen';
import { formatDate, formatDuration, greeting } from '@/lib/dates';
import { minutesOn, streak } from '@/lib/stats';
import { remindersSupported } from '@/lib/notifications';
import { useNow } from '@/lib/useNow';
import { turnOnReminders } from '@/lib/useReminderSync';
import { isPro, useStore } from '@/store/useStore';
import { radius, spacing, useTheme } from '@/theme';

type IconName = keyof typeof Ionicons.glyphMap;

function QuickAction({ icon, label, color, href }: { icon: IconName; label: string; color: string; href: Href }) {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={() => router.push(href)}
      style={({ pressed }) => ({ flex: 1, alignItems: 'center', gap: 8, opacity: pressed ? 0.7 : 1 })}
    >
      <View style={{ width: 56, height: 56, borderRadius: 18, backgroundColor: color + '1F', alignItems: 'center', justifyContent: 'center' }}>
        <Ionicons name={icon} size={26} color={color} />
      </View>
      <AppText variant="tiny" color={colors.text} center numberOfLines={1}>
        {label}
      </AppText>
    </Pressable>
  );
}

export default function Home() {
  const { colors } = useTheme();
  const settings = useStore((s) => s.settings);
  const updateSettings = useStore((s) => s.updateSettings);
  const slots = useStore((s) => s.slots);
  const tasks = useStore((s) => s.tasks);
  const sessions = useStore((s) => s.sessions);
  const decks = useStore((s) => s.decks);
  const sub = useStore((s) => s.subscription);
  const nowMs = useNow();
  const now = new Date(nowMs);
  const weekday = now.getDay();
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const isProf = settings.role === 'professor';

  const todaySlots = slots.filter((s) => s.day === weekday).sort((a, b) => a.start - b.start);
  const current = todaySlots.find((s) => s.start <= nowMin && s.end > nowMin);
  const next = todaySlots.find((s) => s.start > nowMin);
  const upcoming = tasks
    .filter((t) => !t.done)
    .sort((a, b) => a.due.localeCompare(b.due) || b.priority - a.priority)
    .slice(0, 4);
  const studied = minutesOn(sessions, now);
  const goal = settings.dailyGoalMin;
  const days = streak(sessions, now);
  const dueCards = decks.reduce((a, d) => a + d.cards.filter((c) => c.due <= nowMs).length, 0);
  const openTasks = tasks.filter((t) => !t.done).length;
  const firstName = settings.name.split(' ')[0] || (isProf ? 'دكتور' : 'بطل');

  return (
    <Screen inTabs contentStyle={{ paddingTop: spacing.sm }}>
      {/* الترحيب */}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <View style={{ flex: 1 }}>
          <AppText variant="caption" muted>
            {formatDate(now)}
          </AppText>
          <AppText variant="title" numberOfLines={1}>
            {greeting(now)}، {firstName} 👋
          </AppText>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="الإعدادات"
          onPress={() => router.push('/settings')}
          style={{ width: 46, height: 46, borderRadius: 23, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' }}
        >
          <AppText variant="h3" color={colors.primary}>
            {(settings.name.trim()[0] ?? 'م').toUpperCase()}
          </AppText>
        </Pressable>
      </View>

      {/* بطاقة التقدم اليومي */}
      <LinearGradient colors={colors.gradient} start={{ x: 1, y: 0 }} end={{ x: 0, y: 1 }} style={{ borderRadius: radius.xl, padding: spacing.xl, flexDirection: 'row', alignItems: 'center', gap: spacing.lg }}>
        <ProgressRing size={104} stroke={10} progress={studied / goal} color="#FFFFFF" track="rgba(255,255,255,0.22)">
          <AppText variant="h2" color="#FFFFFF">
            {Math.min(100, Math.round((studied / goal) * 100))}%
          </AppText>
        </ProgressRing>
        <View style={{ flex: 1, gap: 6 }}>
          <AppText variant="label" color="rgba(255,255,255,0.8)">
            {isProf ? 'وقت التحضير اليوم' : 'مذاكرة اليوم'}
          </AppText>
          <AppText variant="h2" color="#FFFFFF">
            {formatDuration(studied)} <AppText variant="caption" color="rgba(255,255,255,0.75)">من {formatDuration(goal)}</AppText>
          </AppText>
          <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(255,255,255,0.16)', borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 4 }}>
              <Ionicons name="flame" size={14} color="#FDBA74" />
              <AppText variant="tiny" color="#FFFFFF">
                {days} {days === 1 ? 'يوم' : 'أيام'} متتالية
              </AppText>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(255,255,255,0.16)', borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 4 }}>
              <Ionicons name="checkbox" size={14} color="#A7F3D0" />
              <AppText variant="tiny" color="#FFFFFF">
                {openTasks} مهام مفتوحة
              </AppText>
            </View>
          </View>
        </View>
      </LinearGradient>

      {/* اختصارات */}
      <Card style={{ flexDirection: 'row', paddingVertical: spacing.lg, paddingHorizontal: spacing.sm }}>
        <QuickAction icon="play" label={isProf ? 'جلسة تحضير' : 'ابدأ المذاكرة'} color={colors.primary} href="/focus" />
        <QuickAction icon="add-circle" label="مهمة جديدة" color="#0EA5E9" href="/task/new" />
        <QuickAction icon="albums" label={dueCards ? `بطاقات (${dueCards})` : 'البطاقات'} color="#10B981" href="/decks" />
        <QuickAction icon="calculator" label="المعدل" color="#F59E0B" href="/gpa" />
      </Card>

      {remindersSupported && !settings.remindersEnabled && !settings.remindersPromptDismissed && (slots.length > 0 || tasks.length > 0) && (
        <Card style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, backgroundColor: colors.infoSoft, borderColor: 'transparent' }}>
          <Ionicons name="notifications" size={26} color={colors.info} />
          <View style={{ flex: 1, gap: 2 }}>
            <AppText variant="h3">لا تفوّت أي موعد</AppText>
            <AppText variant="caption" muted>
              نذكّرك قبل المحاضرة وقبل التسليم والاختبار.
            </AppText>
            <View style={{ flexDirection: 'row', gap: 8, marginTop: 6 }}>
              <Button title="فعّل التذكيرات" size="sm" onPress={() => turnOnReminders().then((ok) => !ok && updateSettings({ remindersPromptDismissed: true }))} />
              <Button title="لاحقاً" size="sm" variant="ghost" onPress={() => updateSettings({ remindersPromptDismissed: true })} />
            </View>
          </View>
        </Card>
      )}

      {/* محاضرات اليوم */}
      <SectionHeader title={isProf ? 'محاضراتك اليوم' : 'محاضرات اليوم'} action="الجدول" onAction={() => router.push('/schedule')} />
      {todaySlots.length === 0 ? (
        <Card>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
            <Ionicons name="cafe-outline" size={28} color={colors.textMuted} />
            <View style={{ flex: 1 }}>
              <AppText variant="h3">لا محاضرات اليوم</AppText>
              <AppText variant="caption" muted>
                فرصة ممتازة للمراجعة أو إنجاز الواجبات.
              </AppText>
            </View>
          </View>
        </Card>
      ) : (
        <View style={{ gap: spacing.sm }}>
          {todaySlots
            .filter((s) => s.end > nowMin)
            .slice(0, 3)
            .map((s) => (
              <SlotRow key={s.id} slot={s} highlight={s === current ? 'now' : s === next ? 'next' : undefined} />
            ))}
          {todaySlots.every((s) => s.end <= nowMin) && (
            <Card>
              <AppText variant="label" muted center>
                انتهت محاضرات اليوم ✨
              </AppText>
            </Card>
          )}
        </View>
      )}

      {/* المواعيد القادمة */}
      <SectionHeader title={isProf ? 'مهام قادمة' : 'المواعيد القادمة'} action="عرض الكل" onAction={() => router.push('/tasks')} />
      {upcoming.length === 0 ? (
        <Card padded={false}>
          <EmptyState icon="checkmark-done-outline" title="لا مهام مفتوحة" message="أضف واجباتك واختباراتك لتذكّرك بها." action={{ title: 'إضافة مهمة', onPress: () => router.push('/task/new') }} />
        </Card>
      ) : (
        <View style={{ gap: spacing.sm }}>
          {upcoming.map((t) => (
            <TaskRow key={t.id} task={t} />
          ))}
        </View>
      )}

      {!isPro(sub) && (
        <Card onPress={() => router.push('/pro')} style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, backgroundColor: colors.warningSoft, borderColor: colors.warning + '55' }}>
          <Ionicons name="diamond" size={28} color={colors.warning} />
          <View style={{ flex: 1 }}>
            <AppText variant="h3">جرّب مذاكر برو</AppText>
            <AppText variant="caption" muted>
              مقررات وبطاقات بلا حدود وإحصائيات متقدمة
            </AppText>
          </View>
          <Ionicons name="chevron-back" size={20} color={colors.textMuted} />
        </Card>
      )}
    </Screen>
  );
}
