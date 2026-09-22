import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { EmptyState } from '@/components/EmptyState';
import { Field } from '@/components/Field';
import { CoursePicker } from '@/components/Pickers';
import { ProgressRing } from '@/components/ProgressRing';
import { Screen, SectionHeader } from '@/components/Screen';
import { mastery } from '@/lib/srs';
import { useNow } from '@/lib/useNow';
import { ar, CARDS, DECKS } from '@/lib/plural';
import { FREE_LIMITS, isPro, useStore } from '@/store/useStore';
import { spacing, useTheme } from '@/theme';

export default function Decks() {
  const { colors } = useTheme();
  const decks = useStore((s) => s.decks);
  const courses = useStore((s) => s.courses);
  const role = useStore((s) => s.settings.role);
  const pro = useStore((s) => isPro(s.subscription));
  const addDeck = useStore((s) => s.addDeck);
  const [title, setTitle] = useState('');
  const [courseId, setCourseId] = useState<string | null>(null);
  const [error, setError] = useState<string>();
  const limit = !pro && decks.length >= FREE_LIMITS.decks;
  const now = useNow();

  const create = () => {
    if (limit) return router.push('/pro');
    if (title.trim().length < 2) return setError('اكتب اسم المجموعة');
    const id = addDeck(title.trim(), courseId);
    setTitle('');
    router.push({ pathname: '/decks/[id]', params: { id } });
  };

  return (
    <Screen back title={role === 'professor' ? 'بنك الأسئلة' : 'بطاقات المراجعة'} subtitle="التكرار المتباعد يثبّت المعلومة في ذاكرتك الطويلة">
      {decks.length === 0 ? (
        <Card padded={false}>
          <EmptyState icon="albums-outline" title="لا توجد مجموعات" message="أنشئ مجموعة بطاقات: سؤال في الوجه وجواب في الظهر، وراجعها يومياً." />
        </Card>
      ) : (
        decks.map((d) => {
          const due = d.cards.filter((c) => c.due <= now).length;
          const course = courses.find((c) => c.id === d.courseId);
          const m = mastery(d.cards);
          return (
            <Card key={d.id} onPress={() => router.push({ pathname: '/decks/[id]', params: { id: d.id } })} accessibilityLabel={d.title} style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
              <ProgressRing size={54} stroke={6} progress={m} color={course?.color ?? colors.success}>
                <AppText variant="tiny">{Math.round(m * 100)}%</AppText>
              </ProgressRing>
              <View style={{ flex: 1 }}>
                <AppText variant="h3" numberOfLines={1}>
                  {d.title}
                </AppText>
                <AppText variant="caption" muted>
                  {ar(d.cards.length, CARDS)}{course ? ` · ${course.name}` : ''}
                </AppText>
                {due > 0 && (
                  <AppText variant="tiny" color={colors.warning}>
                    {due} للمراجعة الآن
                  </AppText>
                )}
              </View>
              <Ionicons name="chevron-back" size={20} color={colors.textMuted} />
            </Card>
          );
        })
      )}

      <SectionHeader title="مجموعة جديدة" />
      <Card style={{ gap: spacing.md }}>
        {limit ? (
          <AppText variant="caption" muted>
            الخطة المجانية تتيح {ar(FREE_LIMITS.decks, DECKS)}. اشترك في برو لمجموعات بلا حدود.
          </AppText>
        ) : (
          <>
            <Field placeholder="مثال: مصطلحات الفصل الأول" value={title} onChangeText={(t) => { setTitle(t); setError(undefined); }} error={error} returnKeyType="done" onSubmitEditing={create} />
            {courses.length > 0 && <CoursePicker value={courseId} onChange={setCourseId} />}
          </>
        )}
        <Button title={limit ? 'ترقية إلى برو' : 'إنشاء المجموعة'} icon={limit ? 'diamond' : 'add'} onPress={create} />
      </Card>
    </Screen>
  );
}
