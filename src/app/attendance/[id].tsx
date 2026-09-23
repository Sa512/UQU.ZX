import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { EmptyState } from '@/components/EmptyState';
import { Field } from '@/components/Field';
import { haptic } from '@/components/haptics';
import { DateStrip } from '@/components/Pickers';
import { Screen } from '@/components/Screen';
import { toDateKey } from '@/lib/dates';
import { useStore } from '@/store/useStore';
import { radius, spacing, useTheme } from '@/theme';

export default function Attendance() {
  const { colors } = useTheme();
  const { id, date: dateParam } = useLocalSearchParams<{ id: string; date?: string }>();
  const section = useStore((s) => s.sections.find((x) => x.id === id));
  const course = useStore((s) => s.courses.find((c) => c.id === section?.courseId));
  const allStudents = useStore((s) => s.students);
  const allRecords = useStore((s) => s.attendance);
  const saveAttendance = useStore((s) => s.saveAttendance);
  const [date, setDate] = useState(dateParam ?? toDateKey(new Date()));
  const recordFor = (d: string) => allRecords.find((r) => r.sectionId === id && r.date === d);
  const [absent, setAbsent] = useState<Set<string>>(() => new Set(recordFor(dateParam ?? toDateKey(new Date()))?.absent ?? []));
  const [q, setQ] = useState('');

  if (!section || !course) {
    return (
      <Screen close title="التحضير">
        <EmptyState icon="alert-circle-outline" title="الشعبة غير موجودة" />
      </Screen>
    );
  }
  const students = allStudents.filter((x) => x.sectionId === section.id).sort((a, b) => a.name.localeCompare(b.name, 'ar'));
  const shown = q.trim() ? students.filter((s) => `${s.name} ${s.uniId}`.includes(q.trim())) : students;
  const existing = recordFor(date);

  const changeDate = (d: string) => {
    setDate(d);
    setAbsent(new Set(recordFor(d)?.absent ?? []));
  };
  const toggle = (sid: string) => {
    haptic.tap();
    setAbsent((prev) => {
      const n = new Set(prev);
      if (n.has(sid)) n.delete(sid);
      else n.add(sid);
      return n;
    });
  };
  const save = () => {
    saveAttendance(section.id, date, [...absent]);
    haptic.success();
    router.back();
  };

  return (
    <Screen
      close
      title={`تحضير شعبة ${section.code}`}
      subtitle={`${course.name}${existing ? ' · تعديل تحضير سابق' : ''}`}
      footer={
        <View style={{ gap: 6 }}>
          <AppText variant="caption" muted center>
            حاضر {students.length - absent.size} · غائب {absent.size}
          </AppText>
          <Button title="حفظ التحضير" size="lg" icon="checkmark" onPress={save} />
        </View>
      }
    >
      <DateStrip value={date} onChange={changeDate} past />
      <View style={{ flexDirection: 'row', gap: spacing.sm }}>
        <Button style={{ flex: 1 }} size="sm" variant="secondary" title="الكل حاضر" onPress={() => setAbsent(new Set())} />
        <Button style={{ flex: 1 }} size="sm" variant="ghost" title="الكل غائب" onPress={() => setAbsent(new Set(students.map((s) => s.id)))} />
      </View>
      {students.length > 12 && <Field placeholder="ابحث عن طالب" value={q} onChangeText={setQ} />}
      <AppText variant="caption" muted>
        اضغط على اسم الطالب الغائب فقط — الجميع حاضر افتراضياً.
      </AppText>
      <View style={{ gap: 8 }}>
        {shown.map((s) => {
          const isAbsent = absent.has(s.id);
          return (
            <Pressable
              key={s.id}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: isAbsent }}
              accessibilityLabel={`${s.name}، ${isAbsent ? 'غائب' : 'حاضر'}`}
              onPress={() => toggle(s.id)}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: spacing.md,
                padding: spacing.md,
                borderRadius: radius.md,
                borderWidth: 1.5,
                borderColor: isAbsent ? colors.danger : colors.border,
                backgroundColor: isAbsent ? colors.dangerSoft : colors.surface,
              }}
            >
              <Ionicons name={isAbsent ? 'close-circle' : 'checkmark-circle'} size={26} color={isAbsent ? colors.danger : colors.success} />
              <View style={{ flex: 1 }}>
                <AppText variant="label" numberOfLines={1}>
                  {s.name}
                </AppText>
                {!!s.uniId && (
                  <AppText variant="tiny" muted>
                    {s.uniId}
                  </AppText>
                )}
              </View>
              <AppText variant="label" color={isAbsent ? colors.danger : colors.success}>
                {isAbsent ? 'غائب' : 'حاضر'}
              </AppText>
            </Pressable>
          );
        })}
      </View>
    </Screen>
  );
}
