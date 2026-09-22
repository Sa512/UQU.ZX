import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Pressable, View } from 'react-native';
import { formatMinutes, relativeDue } from '@/lib/dates';
import { SLOT_TYPES, TASK_TYPES } from '@/lib/labels';
import { useStore, type Slot, type Task } from '@/store/useStore';
import { radius, spacing, useTheme } from '@/theme';
import { AppText } from './AppText';
import { haptic } from './haptics';

export function Pill({ label, tone }: { label: string; tone: 'danger' | 'warning' | 'info' | 'muted' | 'success' }) {
  const { colors } = useTheme();
  const map = {
    danger: [colors.dangerSoft, colors.danger],
    warning: [colors.warningSoft, colors.warning],
    info: [colors.infoSoft, colors.info],
    success: [colors.successSoft, colors.success],
    muted: [colors.surfaceAlt, colors.textMuted],
  } as const;
  const [bg, fg] = map[tone];
  return (
    <View style={{ backgroundColor: bg, borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 3, alignSelf: 'flex-start' }}>
      <AppText variant="tiny" color={fg}>
        {label}
      </AppText>
    </View>
  );
}

export function TaskRow({ task }: { task: Task }) {
  const { colors } = useTheme();
  const course = useStore((s) => s.courses.find((c) => c.id === task.courseId));
  const toggle = useStore((s) => s.toggleTask);
  const due = relativeDue(task.due);
  const accent = course?.color ?? colors.primary;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${task.title}، ${due.label}`}
      onPress={() => router.push({ pathname: '/task/new', params: { id: task.id } })}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.md,
        backgroundColor: colors.surface,
        borderRadius: radius.lg,
        borderWidth: 1,
        borderColor: colors.border,
        padding: spacing.md,
        opacity: pressed ? 0.85 : 1,
      })}
    >
      <Pressable
        accessibilityRole="checkbox"
        accessibilityState={{ checked: task.done }}
        accessibilityLabel={task.done ? 'إلغاء الإنجاز' : 'تم الإنجاز'}
        hitSlop={10}
        onPress={() => {
          if (task.done) haptic.tap();
          else haptic.success();
          toggle(task.id);
        }}
      >
        <Ionicons name={task.done ? 'checkmark-circle' : 'ellipse-outline'} size={28} color={task.done ? colors.success : colors.border} />
      </Pressable>
      <View style={{ width: 4, alignSelf: 'stretch', borderRadius: 2, backgroundColor: accent }} />
      <View style={{ flex: 1, gap: 4 }}>
        <AppText variant="h3" numberOfLines={1} style={task.done ? { textDecorationLine: 'line-through', color: colors.textMuted } : undefined}>
          {task.title}
        </AppText>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <AppText variant="caption" muted>
            {TASK_TYPES[task.type].label}
            {course ? ` · ${course.name}` : ''}
          </AppText>
          {!task.done && <Pill label={due.label} tone={due.tone} />}
          {!task.done && task.priority === 3 && <Ionicons name="flag" size={14} color={colors.danger} accessibilityLabel="أولوية عالية" />}
        </View>
      </View>
    </Pressable>
  );
}

export function SlotRow({ slot, highlight }: { slot: Slot; highlight?: 'now' | 'next' }) {
  const { colors } = useTheme();
  const course = useStore((s) => s.courses.find((c) => c.id === slot.courseId));
  const accent = course?.color ?? colors.primary;
  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => router.push({ pathname: '/slot/new', params: { id: slot.id } })}
      style={({ pressed }) => ({
        flexDirection: 'row',
        gap: spacing.md,
        backgroundColor: highlight ? accent + '14' : colors.surface,
        borderRadius: radius.lg,
        borderWidth: highlight ? 1.5 : 1,
        borderColor: highlight ? accent : colors.border,
        padding: spacing.md,
        opacity: pressed ? 0.85 : 1,
      })}
    >
      <View style={{ alignItems: 'center', minWidth: 64, gap: 2 }}>
        <AppText variant="label">{formatMinutes(slot.start)}</AppText>
        <View style={{ width: 2, flex: 1, minHeight: 10, backgroundColor: accent + '55', borderRadius: 1 }} />
        <AppText variant="caption" muted>
          {formatMinutes(slot.end)}
        </AppText>
      </View>
      <View style={{ flex: 1, gap: 4 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: accent }} />
          <AppText variant="h3" numberOfLines={1} style={{ flex: 1 }}>
            {course?.name ?? 'مقرر محذوف'}
          </AppText>
          {highlight === 'now' && <Pill label="الآن" tone="success" />}
          {highlight === 'next' && <Pill label="التالية" tone="info" />}
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Ionicons name={SLOT_TYPES[slot.type].icon} size={15} color={colors.textMuted} />
          <AppText variant="caption" muted>
            {SLOT_TYPES[slot.type].label}
            {course?.code ? ` · ${course.code}` : ''}
          </AppText>
        </View>
        {!!slot.room && (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Ionicons name="location-outline" size={15} color={colors.textMuted} />
            <AppText variant="caption" muted numberOfLines={1}>
              {slot.room}
            </AppText>
          </View>
        )}
      </View>
    </Pressable>
  );
}
