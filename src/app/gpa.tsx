import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Field } from '@/components/Field';
import { haptic } from '@/components/haptics';
import { Stepper } from '@/components/Pickers';
import { Screen, SectionHeader } from '@/components/Screen';
import { Segmented } from '@/components/Segmented';
import { cumulativeGpa, GRADE_INFO, GRADES, gpaRating, requiredTermGpa, round2, termGpa, type Grade, type GradeScale } from '@/lib/gpa';
import { uid } from '@/lib/id';
import { ar, HOURS } from '@/lib/plural';
import { useStore } from '@/store/useStore';
import { radius, spacing, useTheme } from '@/theme';

const num = (s: string) => {
  const n = parseFloat(s.replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d))).replace(',', '.'));
  return Number.isFinite(n) ? n : 0;
};

function GradePicker({ value, onChange }: { value: Grade; onChange: (g: Grade) => void }) {
  const { colors } = useTheme();
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
      {GRADES.map((g) => {
        const active = g === value;
        return (
          <Pressable
            key={g}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            accessibilityLabel={`تقدير ${g}`}
            onPress={() => {
              haptic.tap();
              onChange(g);
            }}
            style={{ minWidth: 44, height: 36, paddingHorizontal: 8, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center', backgroundColor: active ? colors.fill : colors.surfaceAlt }}
          >
            <AppText variant="label" color={active ? '#FFFFFF' : g === 'F' ? colors.danger : colors.text}>
              {g}
            </AppText>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

export default function Gpa() {
  const { colors } = useTheme();
  const scale = useStore((s) => s.settings.gradeScale);
  const updateSettings = useStore((s) => s.updateSettings);
  const gpa = useStore((s) => s.gpa);
  const setGpa = useStore((s) => s.setGpa);
  const courses = useStore((s) => s.courses);
  const [prevGpaText, setPrevGpaText] = useState(gpa.prevGpa ? String(gpa.prevGpa) : '');
  const [prevCreditsText, setPrevCreditsText] = useState(gpa.prevCredits ? String(gpa.prevCredits) : '');
  const [target, setTarget] = useState('');
  const [nextCredits, setNextCredits] = useState(15);

  const prevGpa = Math.min(num(prevGpaText), scale);
  const prevCredits = Math.max(0, Math.round(num(prevCreditsText)));
  const term = termGpa(gpa.rows, scale);
  const cum = cumulativeGpa(prevGpa, prevCredits, gpa.rows, scale);
  const baseCredits = prevCredits + term.credits;
  const targetNum = num(target);
  const need = target ? requiredTermGpa(cum, baseCredits, targetNum, nextCredits, scale) : undefined;
  const gpaError = num(prevGpaText) > scale ? `المعدل لا يتجاوز ${scale}` : undefined;

  const setRows = (rows: typeof gpa.rows) => setGpa({ rows });
  const importCourses = () =>
    setRows(courses.map((c) => ({ id: uid(), name: c.name, credits: c.credits, grade: 'A' as Grade })));

  return (
    <Screen back title="حاسبة المعدل" subtitle="وفق لائحة الجامعات السعودية">
      <Segmented<GradeScale>
        value={scale}
        onChange={(v) => updateSettings({ gradeScale: v })}
        options={[
          { value: 5, label: 'نظام 5 نقاط' },
          { value: 4, label: 'نظام 4 نقاط' },
        ]}
      />

      {/* النتيجة */}
      <Card style={{ backgroundColor: colors.fill, borderColor: 'transparent', flexDirection: 'row' }}>
        <View style={{ flex: 1, alignItems: 'center', gap: 2 }}>
          <AppText variant="tiny" color="rgba(255,255,255,0.8)">
            المعدل الفصلي
          </AppText>
          <AppText variant="title" color="#FFFFFF">
            {term.credits ? round2(term.gpa).toFixed(2) : '—'}
          </AppText>
          <AppText variant="tiny" color="rgba(255,255,255,0.8)">
            {ar(term.credits, HOURS)}
          </AppText>
        </View>
        <View style={{ width: 1, backgroundColor: 'rgba(255,255,255,0.25)' }} />
        <View style={{ flex: 1, alignItems: 'center', gap: 2 }}>
          <AppText variant="tiny" color="rgba(255,255,255,0.8)">
            المعدل التراكمي
          </AppText>
          <AppText variant="title" color="#FFFFFF">
            {baseCredits ? round2(cum).toFixed(2) : '—'}
          </AppText>
          <AppText variant="tiny" color="rgba(255,255,255,0.8)">
            {baseCredits ? gpaRating(cum, scale) : 'أضف مقرراتك'}
          </AppText>
        </View>
      </Card>

      <SectionHeader title="السجل السابق" />
      <View style={{ flexDirection: 'row', gap: spacing.md }}>
        <View style={{ flex: 1 }}>
          <Field
            label="المعدل التراكمي"
            placeholder={scale === 5 ? '4.25' : '3.40'}
            keyboardType="decimal-pad"
            value={prevGpaText}
            error={gpaError}
            onChangeText={setPrevGpaText}
            onEndEditing={() => setGpa({ prevGpa })}
            onBlur={() => setGpa({ prevGpa })}
            ltr
          />
        </View>
        <View style={{ flex: 1 }}>
          <Field
            label="الساعات المجتازة"
            placeholder="60"
            keyboardType="number-pad"
            value={prevCreditsText}
            onChangeText={setPrevCreditsText}
            onEndEditing={() => setGpa({ prevCredits })}
            onBlur={() => setGpa({ prevCredits })}
            ltr
          />
        </View>
      </View>

      <SectionHeader title="مقررات هذا الفصل" action={courses.length && !gpa.rows.length ? 'استيراد مقرراتي' : undefined} onAction={importCourses} />
      {gpa.rows.map((r, i) => (
        <Card key={r.id} style={{ gap: spacing.md }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
            <View style={{ flex: 1 }}>
              <Field
                placeholder={`المقرر ${i + 1}`}
                value={r.name}
                onChangeText={(t) => setRows(gpa.rows.map((x) => (x.id === r.id ? { ...x, name: t } : x)))}
              />
            </View>
            <Pressable accessibilityRole="button" accessibilityLabel="حذف المقرر" hitSlop={8} onPress={() => setRows(gpa.rows.filter((x) => x.id !== r.id))}>
              <Ionicons name="trash-outline" size={22} color={colors.danger} />
            </Pressable>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm, flexWrap: 'wrap' }}>
            <Stepper value={r.credits} min={1} max={6} format={(n) => ar(n, HOURS)} onChange={(n) => setRows(gpa.rows.map((x) => (x.id === r.id ? { ...x, credits: n } : x)))} />
            <AppText variant="caption" muted>
              {GRADE_INFO[r.grade].range} · {scale === 5 ? GRADE_INFO[r.grade].p5 : GRADE_INFO[r.grade].p4} نقطة
            </AppText>
          </View>
          <GradePicker value={r.grade} onChange={(g) => setRows(gpa.rows.map((x) => (x.id === r.id ? { ...x, grade: g } : x)))} />
        </Card>
      ))}
      <Button title="إضافة مقرر" variant="secondary" icon="add" onPress={() => setRows([...gpa.rows, { id: uid(), name: '', credits: 3, grade: 'A' }])} />

      <SectionHeader title="خطّط لمعدلك المستهدف" />
      <Card style={{ gap: spacing.md }}>
        <View style={{ flexDirection: 'row', gap: spacing.md, alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <View style={{ flex: 1, minWidth: 120 }}>
            <Field label="المعدل المستهدف" placeholder={scale === 5 ? '4.50' : '3.50'} keyboardType="decimal-pad" value={target} onChangeText={setTarget} ltr />
          </View>
          <View style={{ gap: 6 }}>
            <AppText variant="label">ساعات الفصل القادم</AppText>
            <Stepper value={nextCredits} min={3} max={24} onChange={setNextCredits} />
          </View>
        </View>
        {target !== '' && (
          <View style={{ backgroundColor: need === null ? colors.dangerSoft : colors.successSoft, borderRadius: radius.md, padding: spacing.md }}>
            <AppText variant="label" color={need === null ? colors.danger : colors.success}>
              {targetNum > scale
                ? `المعدل المستهدف لا يتجاوز ${scale}`
                : need === null
                  ? 'لا يمكن الوصول لهذا المعدل في فصل واحد — وزّع الهدف على أكثر من فصل.'
                  : `تحتاج معدلاً فصلياً ${round2(need!).toFixed(2)} على الأقل في ${ar(nextCredits, HOURS)}.`}
            </AppText>
          </View>
        )}
      </Card>
    </Screen>
  );
}
