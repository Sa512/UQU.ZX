import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { View } from 'react-native';
import { useAbsence } from '@/components/AbsenceCard';
import { AppText } from '@/components/AppText';
import { Card } from '@/components/Card';
import { Pill } from '@/components/Rows';
import { EmptyState } from '@/components/EmptyState';
import { HeaderButton, Screen } from '@/components/Screen';
import { formatDuration } from '@/lib/dates';
import { ar, COURSES, HOURS, SLOTS, TASKS } from '@/lib/plural';
import { FREE_LIMITS, isPro, useStore, type Course } from '@/store/useStore';
import { spacing, useTheme } from '@/theme';

function AbsencePill({ course }: { course: Course }) {
  const st = useAbsence(course);
  const tone = st.level === 'ok' ? 'muted' : st.level === 'warn' ? 'warning' : 'danger';
  return <Pill label={`غياب ${course.absences ?? 0} من ${st.allowed}${st.level === 'barred' ? ' · حرمان' : ''}`} tone={tone} />;
}

export default function Courses() {
  const { colors } = useTheme();
  const courses = useStore((s) => s.courses);
  const slots = useStore((s) => s.slots);
  const tasks = useStore((s) => s.tasks);
  const sessions = useStore((s) => s.sessions);
  const pro = useStore((s) => isPro(s.subscription));
  const role = useStore((s) => s.settings.role);
  const credits = courses.reduce((a, c) => a + c.credits, 0);

  return (
    <Screen
      back
      title="المقررات"
      subtitle={`${ar(courses.length, COURSES)} · الساعات المعتمدة: ${credits}${pro ? '' : ` · الحد المجاني ${FREE_LIMITS.courses}`}`}
      right={<HeaderButton icon="add" label="مقرر جديد" onPress={() => router.push('/course/new')} />}
    >
      {courses.length === 0 ? (
        <Card padded={false}>
          <EmptyState icon="library-outline" title="لا مقررات بعد" message="أضف مقررات هذا الفصل لتنظيم جدولك ومهامك." action={{ title: 'إضافة مقرر', onPress: () => router.push('/course/new') }} />
        </Card>
      ) : (
        courses.map((c) => {
          const weekly = slots.filter((s) => s.courseId === c.id).length;
          const open = tasks.filter((t) => t.courseId === c.id && !t.done).length;
          const studied = sessions.filter((s) => s.courseId === c.id).reduce((a, s) => a + s.minutes, 0);
          return (
            <Card key={c.id} onPress={() => router.push({ pathname: '/course/[id]', params: { id: c.id } })} accessibilityLabel={c.name} style={{ flexDirection: 'row', gap: spacing.md, alignItems: 'center' }}>
              <View style={{ width: 50, height: 50, borderRadius: 16, backgroundColor: c.color, alignItems: 'center', justifyContent: 'center' }}>
                <AppText variant="h3" color="#FFFFFF">
                  {c.name.trim()[0]}
                </AppText>
              </View>
              <View style={{ flex: 1, gap: 2 }}>
                <AppText variant="h3" numberOfLines={1}>
                  {c.name}
                </AppText>
                <AppText variant="caption" muted numberOfLines={1}>
                  {[c.code, ar(c.credits, HOURS), c.instructor].filter(Boolean).join(' · ')}
                </AppText>
                {role === 'student' && (c.absences ?? 0) > 0 && <AbsencePill course={c} />}
                <AppText variant="tiny" color={colors.primary}>
                  {ar(weekly, SLOTS)} · {ar(open, TASKS)} · {formatDuration(studied)} مذاكرة
                </AppText>
              </View>
              <Ionicons name="chevron-back" size={20} color={colors.textMuted} />
            </Card>
          );
        })
      )}
    </Screen>
  );
}
