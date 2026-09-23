import { router } from 'expo-router';
import { Card } from '@/components/Card';
import { EmptyState } from '@/components/EmptyState';
import { Screen, SectionHeader } from '@/components/Screen';
import { AddSection, SectionList } from '@/components/Sections';
import { useStore } from '@/store/useStore';

export default function Sections() {
  const courses = useStore((s) => s.courses.length);
  const sections = useStore((s) => s.sections.length);
  return (
    <Screen back title="الشعب والطلاب" subtitle="التحضير، الغياب، والتواصل مع الطلاب">
      {courses === 0 ? (
        <Card padded={false}>
          <EmptyState icon="library-outline" title="أضف مقرراتك أولاً" message="أو استورد جدولك من بوابة الجامعة وستُنشأ المقررات والشعب تلقائياً." action={{ title: 'استيراد الجدول', onPress: () => router.push('/schedule-import') }} />
        </Card>
      ) : (
        <>
          {sections > 0 ? <SectionList /> : null}
          <SectionHeader title="إضافة" />
          <AddSection />
        </>
      )}
    </Screen>
  );
}
