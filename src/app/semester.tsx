import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { confirm } from '@/components/confirm';
import { haptic } from '@/components/haptics';
import { Screen } from '@/components/Screen';
import { Toggle } from '@/components/Toggle';
import { round2 } from '@/lib/gpa';
import { closeSemester } from '@/lib/semester';
import { useStore } from '@/store/useStore';
import { spacing, useTheme } from '@/theme';

function Row({ label, hint, value, onChange }: { label: string; hint: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
      <View style={{ flex: 1 }}>
        <AppText variant="label">{label}</AppText>
        <AppText variant="caption" muted>
          {hint}
        </AppText>
      </View>
      <Toggle accessibilityLabel={label} value={value} onValueChange={onChange} />
    </View>
  );
}

export default function Semester() {
  const { colors } = useTheme();
  const gpa = useStore((s) => s.gpa);
  const scale = useStore((s) => s.settings.gradeScale);
  const role = useStore((s) => s.settings.role);
  const start = useStore((s) => s.startNewSemester);
  const [mergeGpa, setMergeGpa] = useState(role === 'student' && gpa.rows.length > 0);
  const [clearSchedule, setClearSchedule] = useState(true);
  const [clearTasks, setClearTasks] = useState(true);
  const [clearCourses, setClearCourses] = useState(false);
  const [done, setDone] = useState(false);
  const preview = gpa.rows.length ? closeSemester(gpa.prevGpa, gpa.prevCredits, gpa.rows, scale) : null;

  const run = () =>
    confirm(
      'بدء فصل جديد؟',
      'لا يمكن التراجع. ننصح بتصدير نسخة احتياطية أولاً من الإعدادات.',
      () => {
        start({ mergeGpa, clearSchedule, clearTasks, clearCourses });
        haptic.success();
        setDone(true);
      },
      'ابدأ الفصل',
    );

  return (
    <Screen back title="بدء فصل دراسي جديد" footer={done ? <Button title="إلى الرئيسية" size="lg" onPress={() => router.dismissTo('/')} /> : <Button title="ابدأ الفصل الجديد" size="lg" icon="refresh" onPress={run} />}>
      {done ? (
        <Card style={{ gap: spacing.sm, backgroundColor: colors.successSoft, borderColor: 'transparent' }}>
          <AppText variant="h3">فصل جديد، بداية جديدة ✨</AppText>
          <AppText variant="caption">ابدأ باستيراد جدولك الجديد من «المزيد ← استيراد الجدول».</AppText>
        </Card>
      ) : (
        <>
          <AppText muted>أغلق الفصل الحالي وجهّز التطبيق للفصل القادم. اختر ما تريد:</AppText>
          <Card style={{ gap: spacing.lg }}>
            {role === 'student' && (
              <Row
                label="اعتماد معدل هذا الفصل"
                hint={preview ? `يصبح تراكمك ${round2(preview.prevGpa).toFixed(2)} على ${preview.prevCredits} ساعة` : 'أضف مقررات هذا الفصل في حاسبة المعدل أولاً'}
                value={mergeGpa && !!preview}
                onChange={setMergeGpa}
              />
            )}
            <Row label="مسح الجدول الأسبوعي" hint="المحاضرات والمعامل والساعات المكتبية" value={clearSchedule || clearCourses} onChange={setClearSchedule} />
            <Row label="مسح المهام" hint="الواجبات والاختبارات المنجزة وغير المنجزة" value={clearTasks} onChange={setClearTasks} />
            <Row label="مسح المقررات أيضاً" hint={role === 'professor' ? 'مع الشعب والطلاب والدرجات والتحضير' : 'مع الدرجات؛ تبقى بطاقات المراجعة'} value={clearCourses} onChange={setClearCourses} />
          </Card>
          <AppText variant="caption" muted>
            عند إبقاء المقررات يُصفّر عداد الغياب وسجل التحضير للفصل الجديد. جلسات المذاكرة والإحصائيات تبقى كما هي.
          </AppText>
        </>
      )}
    </Screen>
  );
}
