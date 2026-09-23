import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Share, View } from 'react-native';
import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { EmptyState } from '@/components/EmptyState';
import { haptic } from '@/components/haptics';
import { Stepper } from '@/components/Pickers';
import { Screen, SectionHeader } from '@/components/Screen';
import { Segmented } from '@/components/Segmented';
import { makeGroups } from '@/lib/groups';
import { ar, DECKS, STUDENTS } from '@/lib/plural';
import { useStore, type Student } from '@/store/useStore';
import { radius, spacing, useTheme } from '@/theme';

export default function Groups() {
  const { colors } = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const section = useStore((s) => s.sections.find((x) => x.id === id));
  const course = useStore((s) => s.courses.find((c) => c.id === section?.courseId));
  const allStudents = useStore((s) => s.students);
  const [by, setBy] = useState<'size' | 'count'>('size');
  const [n, setN] = useState(4);
  const [groups, setGroups] = useState<Student[][]>([]);
  const [picked, setPicked] = useState<Student | null>(null);

  if (!section || !course) {
    return (
      <Screen back title="المجموعات">
        <EmptyState icon="alert-circle-outline" title="الشعبة غير موجودة" />
      </Screen>
    );
  }
  const students = allStudents.filter((x) => x.sectionId === section.id);

  const make = () => {
    haptic.success();
    setGroups(makeGroups(students, n, by));
  };
  const pick = () => {
    haptic.tap();
    setPicked(students[Math.floor(Math.random() * students.length)] ?? null);
  };
  const shareText = () =>
    `${course.name} · شعبة ${section.code}\n\n` + groups.map((g, i) => `المجموعة ${i + 1}:\n${g.map((s) => `• ${s.name}${s.uniId ? ` (${s.uniId})` : ''}`).join('\n')}`).join('\n\n');

  return (
    <Screen back title="المجموعات والاختيار العشوائي" subtitle={`${course.name} · شعبة ${section.code} · ${ar(students.length, STUDENTS)}`}>
      {students.length < 2 ? (
        <Card padded={false}>
          <EmptyState icon="people-outline" title="أضف طلاب الشعبة أولاً" />
        </Card>
      ) : (
        <>
          <Card style={{ gap: spacing.md }}>
            <AppText variant="h3">اختيار طالب عشوائي</AppText>
            {picked && (
              <View style={{ backgroundColor: colors.primarySoft, borderRadius: radius.md, padding: spacing.lg, alignItems: 'center' }} accessibilityLiveRegion="polite">
                <AppText variant="h2" color={colors.primary} center>
                  {picked.name}
                </AppText>
                {!!picked.uniId && (
                  <AppText variant="caption" muted>
                    {picked.uniId}
                  </AppText>
                )}
              </View>
            )}
            <Button title={picked ? 'اختيار آخر' : 'اختر طالباً'} icon="shuffle" variant="secondary" onPress={pick} />
          </Card>

          <SectionHeader title="تقسيم الشعبة إلى مجموعات" />
          <Card style={{ gap: spacing.md }}>
            <Segmented
              value={by}
              onChange={setBy}
              options={[
                { value: 'size', label: 'حسب حجم المجموعة' },
                { value: 'count', label: 'حسب عدد المجموعات' },
              ]}
            />
            <Stepper value={n} onChange={setN} min={2} max={Math.max(2, students.length)} format={(v) => (by === 'size' ? `${ar(v, STUDENTS)} لكل مجموعة` : ar(v, DECKS))} />
            <Button title={groups.length ? 'إعادة التقسيم' : 'قسّم عشوائياً'} icon="grid-outline" onPress={make} />
          </Card>

          {groups.map((g, i) => (
            <Card key={i} style={{ gap: 4 }}>
              <AppText variant="h3">
                المجموعة {i + 1} <AppText variant="caption" muted>({ar(g.length, STUDENTS)})</AppText>
              </AppText>
              {g.map((s) => (
                <AppText key={s.id} variant="body">
                  • {s.name}
                </AppText>
              ))}
            </Card>
          ))}
          {groups.length > 0 && <Button title="مشاركة المجموعات" icon="share-outline" variant="ghost" onPress={() => Share.share({ message: shareText() }).catch(() => {})} />}
        </>
      )}
    </Screen>
  );
}
