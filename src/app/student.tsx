import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { Button } from '@/components/Button';
import { confirm } from '@/components/confirm';
import { Field } from '@/components/Field';
import { haptic } from '@/components/haptics';
import { Screen } from '@/components/Screen';
import { latinDigits } from '@/lib/csv';
import { useStore } from '@/store/useStore';

export default function StudentForm() {
  const { sectionId, id } = useLocalSearchParams<{ sectionId: string; id?: string }>();
  const existing = useStore((s) => s.students.find((x) => x.id === id));
  const { addStudents, updateStudent, deleteStudent } = useStore.getState();
  const [name, setName] = useState(existing?.name ?? '');
  const [uniId, setUniId] = useState(existing?.uniId ?? '');
  const [email, setEmail] = useState(existing?.email ?? '');
  const [phone, setPhone] = useState(existing?.phone ?? '');
  const [errors, setErrors] = useState<{ name?: string; email?: string; uniId?: string }>({});

  const save = () => {
    const e: typeof errors = {};
    if (name.trim().length < 2) e.name = 'اكتب اسم الطالب';
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) e.email = 'البريد غير صحيح';
    if (uniId && !/^\d{4,12}$/.test(latinDigits(uniId.trim()))) e.uniId = 'الرقم الجامعي أرقام فقط';
    setErrors(e);
    if (Object.keys(e).length) return;
    const data = { name: name.trim(), uniId: latinDigits(uniId.trim()), email: email.trim().toLowerCase(), phone: latinDigits(phone.trim()) };
    if (existing) updateStudent(existing.id, data);
    else {
      const r = addStudents(sectionId, [data]);
      if (!r.added) return setErrors({ uniId: 'هذا الطالب موجود في الشعبة' });
    }
    haptic.success();
    router.back();
  };

  return (
    <Screen
      close
      title={existing ? 'بيانات الطالب' : 'طالب جديد'}
      footer={
        <View style={{ gap: 8 }}>
          <Button title={existing ? 'حفظ' : 'إضافة'} size="lg" onPress={save} />
          {existing && (
            <Button
              title="حذف من الشعبة"
              variant="danger"
              icon="trash-outline"
              onPress={() =>
                confirm('حذف الطالب؟', existing.name, () => {
                  deleteStudent(existing.id);
                  router.back();
                })
              }
            />
          )}
        </View>
      }
    >
      <Field label="الاسم" value={name} onChangeText={setName} error={errors.name} autoFocus={!existing} />
      <Field label="الرقم الجامعي" value={uniId} onChangeText={setUniId} keyboardType="number-pad" error={errors.uniId} ltr />
      <Field label="البريد الجامعي" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" error={errors.email} ltr />
      <Field label="الجوال (اختياري)" value={phone} onChangeText={setPhone} keyboardType="phone-pad" ltr />
    </Screen>
  );
}
