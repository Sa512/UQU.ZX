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
import { Toggle } from '@/components/Toggle';
import { Segmented } from '@/components/Segmented';
import { addDays, toDateKey } from '@/lib/dates';
import { ar, TASKS } from '@/lib/plural';
import { planReviews } from '@/lib/studyPlan';
import { PRIORITY, TASK_TYPES, TASK_TYPES_BY_ROLE } from '@/lib/labels';
import { useStore, type TaskType } from '@/store/useStore';
import { useTheme } from '@/theme';

export default function TaskForm() {
  const { colors } = useTheme();
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
  const isExam = type === 'exam' || type === 'quiz';
  const [withPlan, setWithPlan] = useState(role === 'student');
  const [planMsg, setPlanMsg] = useState<string>();
  const addTasks = useStore((s) => s.addTasks);
  const addReviewPlan = (examTitle: string, examDue: string) => {
    const plan = planReviews(examTitle, examDue);
    addTasks(plan.map((p) => ({ title: p.title, courseId, type: 'reading' as TaskType, due: p.due, priority: 2 as const, notes: '' })));
    return plan.length;
  };

  const save = () => {
    if (title.trim().length < 2) return setError('اكتب عنوان المهمة');
    const data = { title: title.trim(), courseId, type, due, priority, notes: notes.trim() };
    if (existing) updateTask(existing.id, data);
    else addTask(data);
    if (withPlan && !existing && isExam) addReviewPlan(data.title, data.due);
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
      {isExam && role === 'student' && !existing && (
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <View style={{ flex: 1 }}>
            <AppText variant="label">أنشئ خطة مراجعة تلقائياً</AppText>
            <AppText variant="caption" muted>
              جلسات مراجعة متباعدة قبل الاختبار تُضاف لمهامك
            </AppText>
          </View>
          <Toggle accessibilityLabel="أنشئ خطة مراجعة تلقائياً" value={withPlan} onValueChange={setWithPlan} />
        </View>
      )}
      {isExam && role === 'student' && existing && !existing.done && (
        <View style={{ gap: 6 }}>
          <Button
            title="أنشئ خطة مراجعة لهذا الاختبار"
            variant="secondary"
            icon="calendar-number-outline"
            onPress={() => {
              const n = addReviewPlan(existing.title, existing.due);
              setPlanMsg(n ? `أُضيفت ${ar(n, TASKS)} مراجعة إلى مهامك ✓` : 'الاختبار قريب جداً لخطة مراجعة.');
            }}
          />
          {planMsg && (
            <AppText variant="caption" center color={colors.success}>
              {planMsg}
            </AppText>
          )}
        </View>
      )}
      <Field label="ملاحظات" placeholder="تفاصيل إضافية (اختياري)" value={notes} onChangeText={setNotes} multiline />
    </Screen>
  );
}
