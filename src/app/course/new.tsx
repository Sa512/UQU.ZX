import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { confirm } from '@/components/confirm';
import { Field } from '@/components/Field';
import { haptic } from '@/components/haptics';
import { ColorPicker, Stepper } from '@/components/Pickers';
import { Screen } from '@/components/Screen';
import { FREE_LIMITS, isPro, useStore } from '@/store/useStore';
import { courseColors } from '@/theme';

export default function CourseForm() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const existing = useStore((s) => s.courses.find((c) => c.id === id));
  const count = useStore((s) => s.courses.length);
  const pro = useStore((s) => isPro(s.subscription));
  const role = useStore((s) => s.settings.role);
  const { addCourse, updateCourse, deleteCourse } = useStore.getState();

  const [name, setName] = useState(existing?.name ?? '');
  const [code, setCode] = useState(existing?.code ?? '');
  const [instructor, setInstructor] = useState(existing?.instructor ?? '');
  const [credits, setCredits] = useState(existing?.credits ?? 3);
  const [color, setColor] = useState(existing?.color ?? courseColors[count % courseColors.length]);
  const [error, setError] = useState<string>();

  const limitReached = !existing && !pro && count >= FREE_LIMITS.courses;

  const save = () => {
    if (name.trim().length < 2) return setError('اكتب اسم المقرر');
    const data = { name: name.trim(), code: code.trim().toUpperCase(), instructor: instructor.trim(), credits, color };
    if (existing) updateCourse(existing.id, data);
    else addCourse(data);
    haptic.success();
    router.back();
  };

  return (
    <Screen
      close
      title={existing ? 'تعديل المقرر' : 'مقرر جديد'}
      footer={
        limitReached ? (
          <Button title="ترقية إلى برو لإضافة المزيد" icon="diamond" onPress={() => router.replace('/pro')} />
        ) : (
          <View style={{ gap: 8 }}>
            <Button title={existing ? 'حفظ التعديلات' : 'إضافة المقرر'} size="lg" onPress={save} />
            {existing && (
              <Button
                title="حذف المقرر"
                variant="danger"
                icon="trash-outline"
                onPress={() =>
                  confirm('حذف المقرر؟', 'ستُحذف حصصه من الجدول، وتبقى المهام بدون مقرر.', () => {
                    deleteCourse(existing.id);
                    router.dismissTo('/courses');
                  })
                }
              />
            )}
          </View>
        )
      }
    >
      {limitReached && (
        <AppText muted>
          الخطة المجانية تتيح {FREE_LIMITS.courses} مقررات. اشترك في برو لإضافة مقررات بلا حدود.
        </AppText>
      )}
      <Field label="اسم المقرر" placeholder="مثال: هياكل البيانات" value={name} onChangeText={(t) => { setName(t); setError(undefined); }} error={error} autoFocus={!existing} />
      <Field label="رمز المقرر" placeholder="CS 2301" value={code} onChangeText={setCode} autoCapitalize="characters" ltr />
      {role === 'student' && <Field label="أستاذ المقرر" placeholder="مثال: د. خالد" value={instructor} onChangeText={setInstructor} />}
      <View style={{ gap: 6 }}>
        <AppText variant="label">الساعات المعتمدة</AppText>
        <Stepper value={credits} onChange={setCredits} min={1} max={6} format={(n) => `${n} ساعات`} />
      </View>
      <View style={{ gap: 10 }}>
        <AppText variant="label">لون المقرر</AppText>
        <ColorPicker value={color} onChange={setColor} />
      </View>
    </Screen>
  );
}
