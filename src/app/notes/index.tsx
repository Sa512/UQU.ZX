import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { AppText } from '@/components/AppText';
import { Card } from '@/components/Card';
import { Chip, ChipRow } from '@/components/Chip';
import { EmptyState } from '@/components/EmptyState';
import { Field } from '@/components/Field';
import { Screen, SectionHeader } from '@/components/Screen';
import { formatShortDate } from '@/lib/dates';
import { ar, CARDS } from '@/lib/plural';
import { summaryStats, TEMPLATES, type TemplateId } from '@/lib/summaries';
import { useStore } from '@/store/useStore';
import { radius, spacing, useTheme } from '@/theme';

/** قائمة الملخصات: بحث، وتصفية بالمادة، وملخص جديد من قالب أو من نص ملصوق. */
export default function Notes() {
  const { colors } = useTheme();
  const summaries = useStore((s) => s.summaries);
  const courses = useStore((s) => s.courses);
  const addSummary = useStore((s) => s.addSummary);
  const [q, setQ] = useState('');
  const params = useLocalSearchParams<{ course?: string }>();
  const [courseId, setCourseId] = useState<string | null>(params.course ?? null);

  const used = courses.filter((c) => c.id === courseId || summaries.some((x) => x.courseId === c.id));
  const needle = q.trim();
  const list = summaries.filter(
    (x) => (!courseId || x.courseId === courseId) && (!needle || x.title.includes(needle) || x.blocks.some((b) => b.text.includes(needle) || b.extra?.includes(needle))),
  );

  const create = (t: TemplateId | 'paste') => {
    const tpl = TEMPLATES.find((x) => x.id === t);
    const course = courses.find((c) => c.id === courseId);
    const title = `${tpl && t !== 'blank' ? tpl.title : 'ملخص'}${course ? ` · ${course.name}` : ''}`;
    const id = addSummary(title, courseId, t === 'paste' ? [] : tpl!.make());
    router.push({ pathname: '/notes/[id]', params: { id, edit: '1', ...(t === 'paste' ? { paste: '1' } : {}) } });
  };

  return (
    <Screen back title="ملخصاتي" subtitle="لخّص بأسلوبك، والمصطلحات والأسئلة تتحول لبطاقات مراجعة">
      <SectionHeader title="ملخص جديد" />
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="الصق نصاً ونظّمه تلقائياً"
        onPress={() => create('paste')}
        style={({ pressed }) => ({ borderRadius: radius.lg, padding: spacing.lg, backgroundColor: colors.fill, flexDirection: 'row', alignItems: 'center', gap: spacing.md, opacity: pressed ? 0.9 : 1 })}
      >
        <Ionicons name="sparkles" size={26} color="#FFFFFF" />
        <View style={{ flex: 1 }}>
          <AppText variant="h3" color="#FFFFFF">
            الصق ملاحظاتك ونظّمها تلقائياً
          </AppText>
          <AppText variant="caption" color="#E0E7FF">
            من الواتساب أو ملف أو ملاحظات الجوال: تتحول لعناوين ونقاط ومصطلحات وأسئلة
          </AppText>
        </View>
      </Pressable>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
        {TEMPLATES.map((t) => (
          <Card key={t.id} onPress={() => create(t.id)} accessibilityLabel={t.title} style={{ width: '48.5%', gap: 4, padding: spacing.md }}>
            <Ionicons name={t.icon as keyof typeof Ionicons.glyphMap} size={22} color={colors.primary} />
            <AppText variant="label">{t.title}</AppText>
            <AppText variant="tiny" muted>
              {t.hint}
            </AppText>
          </Card>
        ))}
      </View>

      {summaries.length > 0 && (
        <>
          <SectionHeader title="ملخصاتك" />
          {summaries.length > 3 && <Field placeholder="ابحث في ملخصاتك…" value={q} onChangeText={setQ} returnKeyType="search" />}
          {used.length > 0 && (
            <ChipRow>
              <Chip label="الكل" selected={!courseId} onPress={() => setCourseId(null)} />
              {used.map((c) => (
                <Chip key={c.id} label={c.name} color={c.color} selected={courseId === c.id} onPress={() => setCourseId(c.id)} />
              ))}
            </ChipRow>
          )}
        </>
      )}

      {summaries.length === 0 ? (
        <Card padded={false}>
          <EmptyState icon="document-text-outline" title="لا توجد ملخصات بعد" message="ابدأ بقالب أو الصق ملاحظات المحاضرة، وخلّ التطبيق يرتبها لك." />
        </Card>
      ) : list.length === 0 ? (
        <AppText variant="caption" muted center>
          لا نتائج مطابقة
        </AppText>
      ) : (
        list.map((x) => {
          const c = courses.find((k) => k.id === x.courseId);
          const st = summaryStats(x.blocks);
          const snippet = x.blocks.find((b) => b.type !== 'heading' && b.text.trim())?.text;
          return (
            <Card key={x.id} onPress={() => router.push({ pathname: '/notes/[id]', params: { id: x.id } })} accessibilityLabel={x.title} style={{ flexDirection: 'row', gap: spacing.md, alignItems: 'center' }}>
              <View style={{ width: 6, alignSelf: 'stretch', borderRadius: 3, backgroundColor: c?.color ?? colors.primary }} />
              <View style={{ flex: 1, gap: 2 }}>
                <AppText variant="h3" numberOfLines={1}>
                  {x.title}
                </AppText>
                {!!snippet && (
                  <AppText variant="caption" muted numberOfLines={1}>
                    {snippet}
                  </AppText>
                )}
                <AppText variant="tiny" muted>
                  {[c?.name, `${st.readMin} د قراءة`, st.cards ? ar(st.cards, CARDS) : null, formatShortDate(new Date(x.updatedAt))].filter(Boolean).join(' · ')}
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
