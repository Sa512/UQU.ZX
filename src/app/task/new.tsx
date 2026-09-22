import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { Chip, ChipRow } from '@/components/Chip';
import { confirm } from '@/components/confirm';
import { Field } from '@/components/Field';
import { haptic } from '@/components/haptics';
import { CoursePicker, DateStrip } from '@/components/Pickers';
import { Screen } from '@/components/Screen';
import { Segmented } from '@/components/Segmented';
import { addDays, toDateKey } from '@/lib/dates';
import { PRIORITY, TASK_TYPES, TASK_TYPES_BY_ROLE } from '@/lib/labels';
import { useStore, type TaskType } from '@/store/useStore';

export default function TaskForm() {
  const { id, courseId: presetCourse } = useLocalSearchParams<{ id?: string; courseId?: string }>();
  const existing = useStore((s) => s.tasks.find((t) => t.id === id));
  const role = useStore((s) => s.settings.role);
  const { addTask, updateTask, deleteTask, toggleTask } = useStore.getState();
  const types = TASK_TYPES_BY_ROLE[role];

  const [title, setTitle] = useState(existing?.title ?? '');
  const [courseId, setCourseId] = useState<string | null>(existing?.courseId ?? presetCourse ?? null);
  const [type, setType] = useState<TaskType>(existing?.type ?? types[0]);
  const [due, setDue] = useState(existing?.due ?? toDateKey(addDays(new Date(), 1)));
  const [priority, setPriority] = useState<1 | 2 | 3>(existing?.priority ?? 2);
  const [notes, setNotes] = useState(existing?.notes ?? '');
  const [error, setError] = useState<string>();

  const save = () => {
    if (title.trim().length < 2) return setError('اكتب عنوان المهمة');
    const data = { title: title.trim(), courseId, type, due, priority, notes: notes.trim() };
    if (existing) updateTask(existing.id, data);
    else addTask(data);
    haptic.success();
    router.back();
  };

  const typeList = existing && !types.includes(existing.type) ? [...types, existing.type] : types;

  return (
    <Screen
      close
      title={existing ? 'تعديل المهمة' : 'مهمة جديدة'}
      footer={
        <View style={{ gap: 8 }}>
          <Button title={existing ? 'حفظ' : 'إضافة المهمة'} size="lg" onPress={save} />
          {existing && (
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <Button
                style={{ flex: 1 }}
                title={existing.done ? 'إعادة فتح' : 'تم الإنجاز'}
                variant="secondary"
                icon={existing.done ? 'refresh' : 'checkmark'}
                onPress={() => {
                  toggleTask(existing.id);
                  router.back();
                }}
              />
              <Button
                style={{ flex: 1 }}
                title="حذف"
                variant="danger"
                icon="trash-outline"
                onPress={() =>
                  confirm('حذف المهمة؟', existing.title, () => {
                    deleteTask(existing.id);
                    router.back();
                  })
                }
              />
            </View>
          )}
        </View>
      }
    >
      <Field label="العنوان" placeholder={role === 'student' ? 'مثال: واجب الفصل الثالث' : 'مثال: تصحيح الاختبار الأول'} value={title} onChangeText={(t) => { setTitle(t); setError(undefined); }} error={error} autoFocus={!existing} />
      <View style={{ gap: 8 }}>
        <AppText variant="label">النوع</AppText>
        <ChipRow>
          {typeList.map((t) => (
            <Chip key={t} label={TASK_TYPES[t].label} icon={TASK_TYPES[t].icon} selected={type === t} onPress={() => setType(t)} />
          ))}
        </ChipRow>
      </View>
      <View style={{ gap: 8 }}>
        <AppText variant="label">المقرر</AppText>
        <CoursePicker value={courseId} onChange={setCourseId} />
      </View>
      <View style={{ gap: 8 }}>
        <AppText variant="label">موعد التسليم</AppText>
        <DateStrip value={due} onChange={setDue} />
      </View>
      <View style={{ gap: 8 }}>
        <AppText variant="label">الأولوية</AppText>
        <Segmented<1 | 2 | 3>
          value={priority}
          onChange={setPriority}
          options={([1, 2, 3] as const).map((p) => ({ value: p, label: PRIORITY[p].label }))}
        />
      </View>
      <Field label="ملاحظات" placeholder="تفاصيل إضافية (اختياري)" value={notes} onChangeText={setNotes} multiline />
    </Screen>
  );
}
