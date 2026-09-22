import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { Chip, ChipRow } from '@/components/Chip';
import { confirm } from '@/components/confirm';
import { EmptyState } from '@/components/EmptyState';
import { Field } from '@/components/Field';
import { haptic } from '@/components/haptics';
import { CoursePicker, TimePicker } from '@/components/Pickers';
import { Screen } from '@/components/Screen';
import { DAY_NAMES, formatDuration } from '@/lib/dates';
import { SLOT_TYPES } from '@/lib/labels';
import { useStore, type SlotType } from '@/store/useStore';
import { useTheme } from '@/theme';

export default function SlotForm() {
  const { colors } = useTheme();
  const params = useLocalSearchParams<{ id?: string; day?: string; type?: SlotType }>();
  const existing = useStore((s) => s.slots.find((x) => x.id === params.id));
  const courses = useStore((s) => s.courses);
  const slots = useStore((s) => s.slots);
  const { addSlot, updateSlot, deleteSlot } = useStore.getState();

  const [courseId, setCourseId] = useState<string | null>(existing?.courseId ?? courses[0]?.id ?? null);
  const [day, setDay] = useState(existing?.day ?? (params.day ? Number(params.day) : new Date().getDay()));
  const [type, setType] = useState<SlotType>(existing?.type ?? (params.type && params.type in SLOT_TYPES ? params.type : 'lecture'));
  const [start, setStart] = useState(existing?.start ?? 8 * 60);
  const [end, setEnd] = useState(existing?.end ?? 9 * 60 + 30);
  const [room, setRoom] = useState(existing?.room ?? '');
  const [error, setError] = useState<string>();

  if (!courses.length) {
    return (
      <Screen close title="حصة جديدة">
        <EmptyState icon="library-outline" title="أضف مقرراً أولاً" message="الحصص مرتبطة بالمقررات." action={{ title: 'إضافة مقرر', onPress: () => router.replace('/course/new') }} />
      </Screen>
    );
  }

  const clash = slots.find((s) => s.id !== existing?.id && s.day === day && s.start < end && start < s.end);
  const clashCourse = clash && courses.find((c) => c.id === clash.courseId);

  const save = () => {
    if (!courseId) return setError('اختر المقرر');
    if (end <= start) return setError('وقت النهاية يجب أن يكون بعد البداية');
    const data = { courseId, day, type, start, end, room: room.trim() };
    if (existing) updateSlot(existing.id, data);
    else addSlot(data);
    haptic.success();
    router.back();
  };

  return (
    <Screen
      close
      title={existing ? 'تعديل الحصة' : 'حصة جديدة'}
      footer={
        <View style={{ gap: 8 }}>
          <Button title={existing ? 'حفظ' : 'إضافة إلى الجدول'} size="lg" onPress={save} />
          {existing && (
            <Button
              title="حذف الحصة"
              variant="danger"
              icon="trash-outline"
              onPress={() =>
                confirm('حذف الحصة؟', 'ستُزال من الجدول الأسبوعي.', () => {
                  deleteSlot(existing.id);
                  router.back();
                })
              }
            />
          )}
        </View>
      }
    >
      <View style={{ gap: 8 }}>
        <AppText variant="label">المقرر</AppText>
        <CoursePicker value={courseId} onChange={setCourseId} allowNone={false} />
      </View>
      <View style={{ gap: 8 }}>
        <AppText variant="label">النوع</AppText>
        <ChipRow>
          {(Object.keys(SLOT_TYPES) as SlotType[]).map((t) => (
            <Chip key={t} label={SLOT_TYPES[t].label} icon={SLOT_TYPES[t].icon} selected={type === t} onPress={() => setType(t)} />
          ))}
        </ChipRow>
      </View>
      <View style={{ gap: 8 }}>
        <AppText variant="label">اليوم</AppText>
        <ChipRow>
          {DAY_NAMES.map((d, i) => (
            <Chip key={d} label={d} selected={day === i} onPress={() => setDay(i)} />
          ))}
        </ChipRow>
      </View>
      <TimePicker
        label="من"
        value={start}
        onChange={(v) => {
          const len = end - start;
          setStart(v);
          setEnd(Math.min(23 * 60 + 45, v + Math.max(len, 15)));
          setError(undefined);
        }}
      />
      <TimePicker
        label="إلى"
        value={end}
        onChange={(v) => {
          setEnd(v);
          setError(undefined);
        }}
      />
      <AppText variant="caption" muted>
        المدة: {end > start ? formatDuration(end - start) : '—'}
      </AppText>
      {clash && (
        <AppText variant="caption" color={colors.warning}>
          ⚠︎ يتعارض مع {clashCourse?.name ?? 'حصة أخرى'} في نفس الوقت.
        </AppText>
      )}
      {error && (
        <AppText variant="caption" color={colors.danger}>
          {error}
        </AppText>
      )}
      <Field label="القاعة / المكان" placeholder="مثال: مبنى 5 · قاعة 204" value={room} onChangeText={setRoom} />
    </Screen>
  );
}
