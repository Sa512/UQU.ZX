import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { View } from 'react-native';
import { AbsenceCard } from '@/components/AbsenceCard';
import { ChannelCard } from '@/components/ChannelCard';
import { AddSection, SectionList } from '@/components/Sections';
import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { EmptyState } from '@/components/EmptyState';
import { SlotRow, TaskRow } from '@/components/Rows';
import { HeaderButton, Screen, SectionHeader } from '@/components/Screen';
import { DAY_NAMES, formatDuration } from '@/lib/dates';
import { summarize } from '@/lib/grades';
import { useStore } from '@/store/useStore';
import { radius, spacing, useTheme } from '@/theme';

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ flex: 1, alignItems: 'center', gap: 2 }}>
      <AppText variant="h2" color="#FFFFFF">
        {value}
      </AppText>
      <AppText variant="tiny" color="rgba(255,255,255,0.85)">
        {label}
      </AppText>
    </View>
  );
}

export default function CourseDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const course = useStore((s) => s.courses.find((c) => c.id === id));
  const slots = useStore((s) => s.slots);
  const tasks = useStore((s) => s.tasks);
  const sessions = useStore((s) => s.sessions);
  const role = useStore((s) => s.settings.role);
  const assessments = useStore((s) => s.assessments);
  const hasSections = useStore((s) => s.sections.some((x) => x.courseId === id));
  const { colors } = useTheme();

  if (!course) {
    return (
      <Screen back title="المقرر">
        <EmptyState icon="alert-circle-outline" title="المقرر غير موجود" />
      </Screen>
    );
  }

  const mySlots = slots.filter((s) => s.courseId === id).sort((a, b) => a.day - b.day || a.start - b.start);
  const myTasks = tasks.filter((t) => t.courseId === id).sort((a, b) => Number(a.done) - Number(b.done) || a.due.localeCompare(b.due));
  const grades = summarize(assessments.filter((a) => a.courseId === id));
  const studied = sessions.filter((s) => s.courseId === id).reduce((a, s) => a + s.minutes, 0);

  return (
    <Screen
      back
      title={course.name}
      subtitle={[course.code, course.instructor].filter(Boolean).join(' · ')}
      right={<HeaderButton icon="create-outline" label="تعديل" onPress={() => router.push({ pathname: '/course/new', params: { id: course.id } })} />}
    >
      <View style={{ backgroundColor: course.color, borderRadius: radius.xl, padding: spacing.xl, flexDirection: 'row' }}>
        <Stat label="ساعات معتمدة" value={String(course.credits)} />
        <Stat label="حصص أسبوعياً" value={String(mySlots.length)} />
        <Stat label="وقت المذاكرة" value={formatDuration(studied)} />
      </View>

      {role === 'student' && (
        <Card onPress={() => router.push({ pathname: '/grades/[id]', params: { id: course.id } })} accessibilityLabel="الدرجات" style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
          <Ionicons name="ribbon-outline" size={26} color={course.color} />
          <View style={{ flex: 1 }}>
            <AppText variant="h3">الدرجات</AppText>
            <AppText variant="caption" muted>
              {grades.pct === null ? 'تتبّع درجاتك واعرف ما تحتاجه في النهائي' : `${grades.earned} من ${grades.graded} · المتوقع ${grades.projected}`}
            </AppText>
          </View>
          <Ionicons name="chevron-back" size={20} color={colors.textMuted} />
        </Card>
      )}
      {role === 'student' && course.channel && <ChannelCard course={course} />}
      {role === 'student' && <AbsenceCard course={course} />}

      {role === 'professor' && (
        <>
          <SectionHeader title="الشعب والطلاب" />
          {hasSections && <SectionList courseId={course.id} />}
          <AddSection courseId={course.id} />
        </>
      )}

      <SectionHeader title="المواعيد" action="إضافة" onAction={() => router.push('/slot/new')} />
      {mySlots.length === 0 ? (
        <Card>
          <AppText variant="caption" muted center>
            لم تُضف مواعيد لهذا المقرر.
          </AppText>
        </Card>
      ) : (
        mySlots.map((s) => (
          <View key={s.id} style={{ gap: 4 }}>
            <AppText variant="tiny" muted>
              {DAY_NAMES[s.day]}
            </AppText>
            <SlotRow slot={s} />
          </View>
        ))
      )}

      <SectionHeader title="المهام" action="إضافة" onAction={() => router.push({ pathname: '/task/new', params: { courseId: course.id } })} />
      {myTasks.length === 0 ? (
        <Card>
          <AppText variant="caption" muted center>
            لا مهام لهذا المقرر.
          </AppText>
        </Card>
      ) : (
        <View style={{ gap: spacing.sm }}>
          {myTasks.map((t) => (
            <TaskRow key={t.id} task={t} />
          ))}
        </View>
      )}

      <Button title="ابدأ جلسة مذاكرة" icon="play" onPress={() => router.navigate('/focus')} />
    </Screen>
  );
}
