import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Linking, Pressable, Share, View } from 'react-native';
import { weeklyMeetings } from '@/components/AbsenceCard';
import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { confirm } from '@/components/confirm';
import { EmptyState } from '@/components/EmptyState';
import { Field } from '@/components/Field';
import { Pill } from '@/components/Rows';
import { HeaderButton, Screen, SectionHeader } from '@/components/Screen';
import { Segmented } from '@/components/Segmented';
import { studentAttendance } from '@/lib/attendance';
import { toCsv } from '@/lib/csv';
import { formatShortDate, fromDateKey, toDateKey } from '@/lib/dates';
import { fileExportSupported, shareCsv } from '@/lib/exportIO';
import { ABSENCES, ar, LECTURES, MEETINGS, STUDENTS, WEEKS } from '@/lib/plural';
import { useStore } from '@/store/useStore';
import { spacing, useTheme } from '@/theme';

type Tab = 'students' | 'absence' | 'sessions';

export default function SectionScreen() {
  const { colors } = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const section = useStore((s) => s.sections.find((x) => x.id === id));
  const course = useStore((s) => s.courses.find((c) => c.id === section?.courseId));
  const allStudents = useStore((s) => s.students);
  const allAttendance = useStore((s) => s.attendance);
  const slots = useStore((s) => s.slots);
  const weeks = useStore((s) => s.settings.semesterWeeks);
  const deleteSection = useStore((s) => s.deleteSection);
  const [tab, setTab] = useState<Tab>('students');
  const [q, setQ] = useState('');
  const [msg, setMsg] = useState<string>();

  if (!section || !course) {
    return (
      <Screen back title="الشعبة">
        <EmptyState icon="alert-circle-outline" title="الشعبة غير موجودة" />
      </Screen>
    );
  }

  const students = allStudents.filter((x) => x.sectionId === section.id).sort((a, b) => a.name.localeCompare(b.name, 'ar'));
  const records = allAttendance.filter((r) => r.sectionId === section.id).sort((a, b) => b.date.localeCompare(a.date));
  const sectionSlots = slots.filter((x) => x.sectionId === section.id && x.type !== 'office');
  const weekly = sectionSlots.length || weeklyMeetings(course.id, course.credits, slots);
  const stats = studentAttendance(students.map((x) => x.id), records, weekly, weeks);
  const statOf = new Map(stats.map((x) => [x.studentId, x]));
  const atRisk = stats.filter((x) => x.status.level === 'danger' || x.status.level === 'barred').length;
  const filtered = q.trim() ? students.filter((x) => `${x.name} ${x.uniId} ${x.email}`.toLowerCase().includes(q.trim().toLowerCase())) : students;
  const emails = students.map((x) => x.email).filter(Boolean);

  const exportSheet = async () => {
    const rows: (string | number)[][] = [['الاسم', 'الرقم الجامعي', 'البريد', 'الجوال', 'مرات الغياب', 'نسبة الغياب', 'الحالة']];
    for (const s of students) {
      const st = statOf.get(s.id)!;
      const state = { ok: 'منتظم', warn: 'تنبيه', danger: 'إنذار', barred: 'محروم' }[st.status.level];
      rows.push([s.name, s.uniId, s.email, s.phone, st.absences, `${Math.round(st.status.pct * 100)}%`, state]);
    }
    const r = await shareCsv(`${course.code || course.name}-${section.code}-${toDateKey(new Date())}.csv`.replace(/\s+/g, '-'), toCsv(rows));
    setMsg(r.ok ? undefined : r.message);
  };

  return (
    <Screen
      back
      title={`${course.name} · شعبة ${section.code}`}
      subtitle={`${ar(students.length, STUDENTS)} · ${ar(records.length, { one: 'محاضرة محضّرة', two: 'محاضرتين محضّرتين', few: 'محاضرات محضّرة', many: 'محاضرة محضّرة' })}`}
      right={
        <HeaderButton
          icon="trash-outline"
          label="حذف الشعبة"
          onPress={() =>
            confirm('حذف الشعبة؟', 'سيُحذف الطلاب وسجل الحضور لهذه الشعبة.', () => {
              deleteSection(section.id);
              router.back();
            })
          }
        />
      }
    >
      <View style={{ flexDirection: 'row', gap: spacing.sm }}>
        <Button style={{ flex: 1 }} title="تحضير اليوم" icon="checkmark-done" disabled={!students.length} onPress={() => router.push({ pathname: '/attendance/[id]', params: { id: section.id } })} />
        <Button style={{ flex: 1 }} title="استيراد طلاب" icon="cloud-download-outline" variant="secondary" onPress={() => router.push({ pathname: '/roster-import', params: { sectionId: section.id } })} />
      </View>

      {atRisk > 0 && (
        <Card style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, backgroundColor: colors.dangerSoft, borderColor: 'transparent' }}>
          <Ionicons name="warning" size={22} color={colors.danger} />
          <AppText variant="label" color={colors.danger} style={{ flex: 1 }}>
            {ar(atRisk, STUDENTS)} قريبون من الحرمان أو تجاوزوه
          </AppText>
          <Pressable onPress={() => setTab('absence')} hitSlop={8}>
            <AppText variant="label" color={colors.primary}>
              عرض
            </AppText>
          </Pressable>
        </Card>
      )}

      <Segmented<Tab>
        value={tab}
        onChange={setTab}
        options={[
          { value: 'students', label: 'الطلاب' },
          { value: 'absence', label: 'الغياب' },
          { value: 'sessions', label: 'سجل التحضير' },
        ]}
      />

      {tab === 'students' && (
        <>
          {students.length === 0 ? (
            <Card padded={false}>
              <EmptyState
                icon="people-outline"
                title="لا يوجد طلاب بعد"
                message="انسخ قائمة الطلاب من Excel أو النظام الأكاديمي والصقها، أو أضفهم واحداً واحداً."
                action={{ title: 'استيراد قائمة', onPress: () => router.push({ pathname: '/roster-import', params: { sectionId: section.id } }) }}
              />
            </Card>
          ) : (
            <>
              <Field placeholder="ابحث بالاسم أو الرقم الجامعي" value={q} onChangeText={setQ} />
              <Card padded={false}>
                {filtered.map((s, i) => {
                  const st = statOf.get(s.id)!;
                  return (
                    <Pressable
                      key={s.id}
                      accessibilityRole="button"
                      accessibilityLabel={s.name}
                      onPress={() => router.push({ pathname: '/student', params: { sectionId: section.id, id: s.id } })}
                      style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md, borderTopWidth: i ? 1 : 0, borderTopColor: colors.border, opacity: pressed ? 0.7 : 1 })}
                    >
                      <View style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: course.color + '22', alignItems: 'center', justifyContent: 'center' }}>
                        <AppText variant="label" color={course.color}>
                          {s.name.trim()[0]}
                        </AppText>
                      </View>
                      <View style={{ flex: 1 }}>
                        <AppText variant="label" numberOfLines={1}>
                          {s.name}
                        </AppText>
                        <AppText variant="tiny" muted numberOfLines={1}>
                          {[s.uniId, s.email].filter(Boolean).join(' · ') || 'لا بيانات إضافية'}
                        </AppText>
                      </View>
                      {st.absences > 0 && <Pill label={`غياب ${st.absences}`} tone={st.status.level === 'ok' ? 'muted' : st.status.level === 'warn' ? 'warning' : 'danger'} />}
                    </Pressable>
                  );
                })}
              </Card>
            </>
          )}
          <Button title="إضافة طالب" variant="ghost" icon="person-add-outline" onPress={() => router.push({ pathname: '/student', params: { sectionId: section.id } })} />
          {emails.length > 0 && (
            <>
              <SectionHeader title="التواصل مع الشعبة" />
              <View style={{ flexDirection: 'row', gap: spacing.sm }}>
                <Button
                  style={{ flex: 1 }}
                  title="مراسلة الكل"
                  icon="mail-outline"
                  variant="secondary"
                  onPress={() => Linking.openURL(`mailto:?bcc=${emails.join(',')}&subject=${encodeURIComponent(`${course.name} - شعبة ${section.code}`)}`).catch(() => setMsg('لا يوجد تطبيق بريد مهيأ على الجهاز.'))}
                />
                <Button style={{ flex: 1 }} title="مشاركة الإيميلات" icon="copy-outline" variant="ghost" onPress={() => Share.share({ message: emails.join(', ') }).catch(() => {})} />
              </View>
            </>
          )}
        </>
      )}

      {tab === 'absence' && (
        <>
          <AppText variant="caption" muted>
            الحد المسموح: {ar(stats[0]?.status.allowed ?? 0, ABSENCES)} من {ar(stats[0]?.status.total ?? weekly * weeks, LECTURES)} (25%) — {ar(weekly, MEETINGS)} أسبوعياً × {ar(weeks, WEEKS)}.
          </AppText>
          <Card padded={false}>
            {[...stats]
              .sort((a, b) => b.absences - a.absences)
              .map((st, i) => {
                const s = students.find((x) => x.id === st.studentId)!;
                const tone = st.status.level === 'ok' ? 'muted' : st.status.level === 'warn' ? 'warning' : 'danger';
                const label = { ok: 'منتظم', warn: 'تنبيه', danger: 'إنذار', barred: 'محروم' }[st.status.level];
                return (
                  <View key={st.studentId} style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md, borderTopWidth: i ? 1 : 0, borderTopColor: colors.border }}>
                    <View style={{ flex: 1 }}>
                      <AppText variant="label" numberOfLines={1}>
                        {s.name}
                      </AppText>
                      <AppText variant="tiny" muted>
                        غياب: {st.absences} · {Math.round(st.status.pct * 100)}%
                      </AppText>
                    </View>
                    <Pill label={label} tone={tone} />
                  </View>
                );
              })}
          </Card>
          {fileExportSupported && <Button title="تصدير كشف الغياب (Excel)" icon="document-text-outline" variant="secondary" onPress={exportSheet} />}
        </>
      )}

      {tab === 'sessions' && (
        <Card padded={false}>
          {records.length === 0 ? (
            <EmptyState icon="calendar-outline" title="لم تحضّر أي محاضرة بعد" message="اضغط «تحضير اليوم» في بداية المحاضرة." />
          ) : (
            records.map((r, i) => (
              <Pressable
                key={r.id}
                accessibilityRole="button"
                onPress={() => router.push({ pathname: '/attendance/[id]', params: { id: section.id, date: r.date } })}
                style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md, borderTopWidth: i ? 1 : 0, borderTopColor: colors.border, opacity: pressed ? 0.7 : 1 })}
              >
                <Ionicons name="calendar-outline" size={20} color={colors.textMuted} />
                <AppText variant="label" style={{ flex: 1 }}>
                  {formatShortDate(fromDateKey(r.date))}
                </AppText>
                <AppText variant="caption" muted>
                  حضور {students.length - r.absent.length} · غياب {r.absent.length}
                </AppText>
                <Ionicons name="chevron-back" size={18} color={colors.textMuted} />
              </Pressable>
            ))
          )}
        </Card>
      )}

      {msg && (
        <AppText variant="caption" color={colors.danger}>
          {msg}
        </AppText>
      )}
      <AppText variant="tiny" muted center>
        بيانات الطلاب محفوظة على جهازك فقط ولا تُرسل لأي خادم.
      </AppText>
    </Screen>
  );
}
