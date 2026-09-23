import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { AppText } from './AppText';
import { Button } from './Button';
import { Card } from './Card';
import { Field } from './Field';
import { CoursePicker } from './Pickers';
import { ar, STUDENTS } from '@/lib/plural';
import { useStore } from '@/store/useStore';
import { spacing, useTheme } from '@/theme';

/** قائمة شعب عضو هيئة التدريس مجمّعة حسب المقرر، مع إضافة شعبة. */
export function SectionList({ courseId }: { courseId?: string }) {
  const { colors } = useTheme();
  const courses = useStore((s) => s.courses);
  const sections = useStore((s) => s.sections);
  const students = useStore((s) => s.students);
  const shown = courseId ? sections.filter((x) => x.courseId === courseId) : sections;
  return (
    <Card padded={false}>
      {shown.map((sec, i) => {
        const c = courses.find((x) => x.id === sec.courseId);
        const n = students.filter((x) => x.sectionId === sec.id).length;
        return (
          <Pressable
            key={sec.id}
            accessibilityRole="button"
            accessibilityLabel={`شعبة ${sec.code}`}
            onPress={() => router.push({ pathname: '/section/[id]', params: { id: sec.id } })}
            style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md, borderTopWidth: i ? 1 : 0, borderTopColor: colors.border, opacity: pressed ? 0.7 : 1 })}
          >
            <View style={{ width: 10, height: 36, borderRadius: 5, backgroundColor: c?.color ?? colors.primary }} />
            <View style={{ flex: 1 }}>
              <AppText variant="label">
                شعبة {sec.code}
                {!courseId && c ? ` · ${c.name}` : ''}
              </AppText>
              <AppText variant="tiny" muted>
                {n ? ar(n, STUDENTS) : 'لا يوجد طلاب بعد'}
              </AppText>
            </View>
            <Ionicons name="chevron-back" size={18} color={colors.textMuted} />
          </Pressable>
        );
      })}
    </Card>
  );
}

export function AddSection({ courseId: fixed }: { courseId?: string }) {
  const courses = useStore((s) => s.courses);
  const addSection = useStore((s) => s.addSection);
  const [courseId, setCourseId] = useState<string | null>(fixed ?? courses[0]?.id ?? null);
  const [code, setCode] = useState('');
  const [error, setError] = useState<string>();
  const add = () => {
    if (!courseId) return setError('اختر المقرر');
    if (!code.trim()) return setError('اكتب رقم الشعبة');
    const id = addSection(courseId, code);
    setCode('');
    setError(undefined);
    router.push({ pathname: '/section/[id]', params: { id } });
  };
  return (
    <Card style={{ gap: spacing.md }}>
      <AppText variant="h3">شعبة جديدة</AppText>
      {!fixed && courses.length > 0 && <CoursePicker value={courseId} onChange={setCourseId} allowNone={false} />}
      <Field placeholder="رقم الشعبة، مثال: 1041" value={code} onChangeText={(t) => { setCode(t); setError(undefined); }} error={error} ltr />
      <Button title="إضافة الشعبة" variant="secondary" icon="add" onPress={add} />
    </Card>
  );
}

