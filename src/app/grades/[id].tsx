import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Chip, ChipRow } from '@/components/Chip';
import { EmptyState } from '@/components/EmptyState';
import { Field } from '@/components/Field';
import { haptic } from '@/components/haptics';
import { Pill } from '@/components/Rows';
import { Screen, SectionHeader } from '@/components/Screen';
import { GRADE_INFO } from '@/lib/gpa';
import { summarize, type Assessment } from '@/lib/grades';
import { useStore } from '@/store/useStore';
import { radius, spacing, useTheme } from '@/theme';

const toNum = (s: string) => {
  const n = parseFloat(s.replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d))).replace(',', '.'));
  return Number.isFinite(n) ? n : null;
};

const PRESETS: [string, number][] = [
  ['الاختبار الفصلي الأول', 20],
  ['الاختبار الفصلي الثاني', 20],
  ['الواجبات', 10],
  ['المشاركة والحضور', 10],
  ['الاختبار النهائي', 40],
];

function ItemRow({ item }: { item: Assessment }) {
  const { colors } = useTheme();
  const update = useStore((s) => s.updateAssessment);
  const remove = useStore((s) => s.deleteAssessment);
  const [text, setText] = useState(item.got === null ? '' : String(item.got));
  const save = () => {
    const n = toNum(text);
    update(item.id, { got: n === null ? null : Math.min(Math.max(n, 0), item.outOf) });
    if (n !== null && n > item.outOf) setText(String(item.outOf));
  };
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
      <View style={{ flex: 1 }}>
        <AppText variant="label" numberOfLines={1}>
          {item.name}
        </AppText>
        <AppText variant="tiny" muted>
          من {item.outOf} درجة{item.got === null ? ' · لم تُرصد بعد' : ''}
        </AppText>
      </View>
      <View style={{ width: 84 }}>
        <Field accessibilityLabel={`درجة ${item.name}`} placeholder="—" keyboardType="decimal-pad" value={text} onChangeText={setText} onBlur={save} onEndEditing={save} ltr style={{ minHeight: 44, textAlign: 'center' }} />
      </View>
      <AppText variant="caption" muted>
        / {item.outOf}
      </AppText>
      <Pressable accessibilityRole="button" accessibilityLabel={`حذف ${item.name}`} hitSlop={8} onPress={() => remove(item.id)}>
        <Ionicons name="close-circle-outline" size={22} color={colors.textMuted} />
      </Pressable>
    </View>
  );
}

export default function Grades() {
  const { colors } = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const course = useStore((s) => s.courses.find((c) => c.id === id));
  const all = useStore((s) => s.assessments);
  const add = useStore((s) => s.addAssessment);
  const [name, setName] = useState('');
  const [outOf, setOutOf] = useState('');
  const [error, setError] = useState<string>();

  if (!course) {
    return (
      <Screen back title="الدرجات">
        <EmptyState icon="alert-circle-outline" title="المقرر غير موجود" />
      </Screen>
    );
  }
  const items = all.filter((a) => a.courseId === course.id);
  const s = summarize(items);

  const addItem = (n: string, o: number) => {
    if (n.trim().length < 2) return setError('اكتب اسم التقييم');
    if (!(o > 0 && o <= 100)) return setError('الدرجة بين 1 و100');
    add({ courseId: course.id, name: n.trim(), outOf: o, got: null });
    haptic.success();
    setName('');
    setOutOf('');
    setError(undefined);
  };

  return (
    <Screen back title={`درجات ${course.name}`} subtitle="من 100 درجة">
      <View style={{ backgroundColor: course.color, borderRadius: radius.xl, padding: spacing.xl, gap: spacing.sm }}>
        <AppText variant="label" color="rgba(255,255,255,0.85)">
          مجموعك حتى الآن
        </AppText>
        <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8 }}>
          <AppText variant="display" color="#FFFFFF">
            {s.earned}
          </AppText>
          <AppText variant="h3" color="rgba(255,255,255,0.85)">
            من {s.graded}
          </AppText>
        </View>
        <AppText variant="caption" color="#FFFFFF">
          {s.pct === null
            ? 'أضف تقييمات المقرر ودرجاتك لتعرف ما تحتاجه في النهائي.'
            : `نسبتك ${Math.round(s.pct * 100)}% · التقدير المتوقع ${s.projected} (${GRADE_INFO[s.projected!].ar}) · أعلى مجموع ممكن ${s.best}`}
        </AppText>
      </View>

      <SectionHeader title="التقييمات" />
      <Card style={{ gap: spacing.md }}>
        {items.length === 0 ? (
          <AppText variant="caption" muted center>
            لم تُضف تقييمات بعد. ابدأ من الاقتراحات بالأسفل.
          </AppText>
        ) : (
          items.map((it) => <ItemRow key={it.id} item={it} />)
        )}
        {s.planned > 100 && (
          <AppText variant="caption" color={colors.danger}>
            مجموع التوزيع {s.planned} درجة ويتجاوز 100 — راجع درجات التقييمات.
          </AppText>
        )}
        {items.length > 0 && s.planned < 100 && (
          <AppText variant="caption" color={colors.warning}>
            وزّعت {s.planned} من 100 درجة. الباقي ({100 - s.planned}) يُعد غير مرصود.
          </AppText>
        )}
      </Card>

      <Card style={{ gap: spacing.md }}>
        <AppText variant="h3">إضافة تقييم</AppText>
        <ChipRow>
          {PRESETS.filter(([n]) => !items.some((i) => i.name === n)).map(([n, o]) => (
            <Chip key={n} label={`${n} (${o})`} icon="add" onPress={() => addItem(n, o)} />
          ))}
        </ChipRow>
        <View style={{ flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-start' }}>
          <View style={{ flex: 1 }}>
            <Field placeholder="اسم التقييم" value={name} onChangeText={(t) => { setName(t); setError(undefined); }} error={error} />
          </View>
          <View style={{ width: 90 }}>
            <Field accessibilityLabel="من كم درجة" placeholder="من" keyboardType="number-pad" value={outOf} onChangeText={setOutOf} ltr style={{ textAlign: 'center' }} />
          </View>
        </View>
        <Button title="إضافة" variant="secondary" icon="add" onPress={() => addItem(name, toNum(outOf) ?? 0)} />
      </Card>

      <SectionHeader title="ماذا تحتاج لكل تقدير؟" />
      <Card style={{ gap: spacing.sm }}>
        {s.targets.map((t) => (
          <View key={t.grade} style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: 4 }}>
            <View style={{ width: 44, height: 32, borderRadius: radius.sm, backgroundColor: colors.surfaceAlt, alignItems: 'center', justifyContent: 'center' }}>
              <AppText variant="label">{t.grade}</AppText>
            </View>
            <AppText variant="body" style={{ flex: 1 }}>
              {t.status === 'secured' ? 'مضمون ✓' : t.status === 'impossible' ? 'غير ممكن هذا الفصل' : `تحتاج ${t.need} من ${s.remaining} المتبقية`}
            </AppText>
            {t.status === 'possible' && s.remaining > 0 && (
              <Pill label={`${Math.round((t.need / s.remaining) * 100)}%`} tone={t.need / s.remaining > 0.9 ? 'danger' : t.need / s.remaining > 0.7 ? 'warning' : 'success'} />
            )}
          </View>
        ))}
      </Card>
    </Screen>
  );
}
