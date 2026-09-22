import { router, useLocalSearchParams } from 'expo-router';
import { View } from 'react-native';
import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { EmptyState } from '@/components/EmptyState';
import { SlotRow, TaskRow } from '@/components/Rows';
import { HeaderButton, Screen, SectionHeader } from '@/components/Screen';
import { DAY_NAMES, formatDuration } from '@/lib/dates';
import { useStore } from '@/store/useStore';
import { radius, spacing } from '@/theme';

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

  if (!course) {
    return (
      <Screen back title="المقرر">
        <EmptyState icon="alert-circle-outline" title="المقرر غير موجود" />
      </Screen>
    );
  }

  const mySlots = slots.filter((s) => s.courseId === id).sort((a, b) => a.day - b.day || a.start - b.start);
  const myTasks = tasks.filter((t) => t.courseId === id).sort((a, b) => Number(a.done) - Number(b.done) || a.due.localeCompare(b.due));
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
