import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { View } from 'react-native';
import { AppText } from '@/components/AppText';
import { Card } from '@/components/Card';
import { EmptyState } from '@/components/EmptyState';
import { HeaderButton, Screen } from '@/components/Screen';
import { formatDuration } from '@/lib/dates';
import { FREE_LIMITS, isPro, useStore } from '@/store/useStore';
import { spacing, useTheme } from '@/theme';

export default function Courses() {
  const { colors } = useTheme();
  const courses = useStore((s) => s.courses);
  const slots = useStore((s) => s.slots);
  const tasks = useStore((s) => s.tasks);
  const sessions = useStore((s) => s.sessions);
  const pro = useStore((s) => isPro(s.subscription));
  const credits = courses.reduce((a, c) => a + c.credits, 0);

  return (
    <Screen
      back
      title="المقررات"
      subtitle={`${courses.length} مقررات · ${credits} ساعة معتمدة${pro ? '' : ` · الحد المجاني ${FREE_LIMITS.courses}`}`}
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
                  {[c.code, `${c.credits} ساعات`, c.instructor].filter(Boolean).join(' · ')}
                </AppText>
                <AppText variant="tiny" color={colors.primary}>
                  {weekly} حصص · {open} مهام · {formatDuration(studied)} مذاكرة
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
