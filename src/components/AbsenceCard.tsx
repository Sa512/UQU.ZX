import { View } from 'react-native';
import { absenceStatus, type AbsenceLevel } from '@/lib/absence';
import { ABSENCES, ar, LECTURES } from '@/lib/plural';
import { useStore, type Course } from '@/store/useStore';
import { radius, spacing, useTheme } from '@/theme';
import { AppText } from './AppText';
import { Button } from './Button';
import { Card } from './Card';
import { haptic } from './haptics';

/** عدد لقاءات المقرر أسبوعياً (المحاضرات والمعامل، دون الساعات المكتبية). */
export function weeklyMeetings(courseId: string, credits: number, slots: { courseId: string; type: string }[]) {
  const n = slots.filter((s) => s.courseId === courseId && s.type !== 'office').length;
  return n || credits;
}

export function useAbsence(course: Course) {
  const slots = useStore((s) => s.slots);
  const weeks = useStore((s) => s.settings.semesterWeeks);
  return absenceStatus(course.absences ?? 0, weeklyMeetings(course.id, course.credits, slots), weeks);
}

const TEXT: Record<AbsenceLevel, string> = {
  ok: 'وضعك ممتاز، حافظ على الحضور.',
  warn: 'انتبه: تجاوزت نصف الغياب المسموح.',
  danger: 'تحذير: أنت على وشك الحرمان من الاختبار النهائي.',
  barred: 'تجاوزت 25% من المحاضرات — راجع القسم بخصوص الحرمان.',
};

export function AbsenceCard({ course }: { course: Course }) {
  const { colors } = useTheme();
  const adjust = useStore((s) => s.adjustAbsence);
  const st = useAbsence(course);
  const absences = course.absences ?? 0;
  const tone = { ok: colors.success, warn: colors.warning, danger: colors.danger, barred: colors.danger }[st.level];
  const soft = { ok: colors.successSoft, warn: colors.warningSoft, danger: colors.dangerSoft, barred: colors.dangerSoft }[st.level];
  return (
    <Card style={{ gap: spacing.md }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <AppText variant="h3">الغياب</AppText>
        <AppText variant="caption" muted>
          {absences} من {st.allowed} مسموح · {Math.round(st.pct * 100)}%
        </AppText>
      </View>
      <View style={{ height: 10, borderRadius: 5, backgroundColor: colors.surfaceAlt, overflow: 'hidden' }} accessibilityLabel={`الغياب ${absences} من ${st.allowed}`}>
        <View style={{ width: `${Math.min(100, st.allowed ? (absences / st.allowed) * 100 : 100)}%`, height: '100%', backgroundColor: tone, borderRadius: 5 }} />
      </View>
      <View style={{ backgroundColor: soft, borderRadius: radius.md, padding: spacing.md }}>
        <AppText variant="label" color={tone}>
          {TEXT[st.level]}
          {st.level !== 'barred' && st.remaining >= 0 ? ` متبقٍ لك ${ar(st.remaining, ABSENCES)}.` : ''}
        </AppText>
      </View>
      <View style={{ flexDirection: 'row', gap: spacing.sm }}>
        <Button
          style={{ flex: 1 }}
          title="سجّل غياباً"
          variant="secondary"
          icon="add"
          onPress={() => {
            adjust(course.id, 1);
            haptic.warn();
          }}
        />
        <Button style={{ flex: 1 }} title="تراجع" variant="ghost" icon="remove" disabled={!absences} onPress={() => adjust(course.id, -1)} />
      </View>
      <AppText variant="tiny" muted>
        محسوب على {ar(st.total, LECTURES)} في الفصل (يمكن تعديل عدد الأسابيع من الإعدادات).
      </AppText>
    </Card>
  );
}
