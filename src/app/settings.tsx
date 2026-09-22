import { router } from 'expo-router';
import Constants from 'expo-constants';
import { useState } from 'react';
import { Linking, View } from 'react-native';
import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Chip, ChipRow } from '@/components/Chip';
import { confirm } from '@/components/confirm';
import { Field } from '@/components/Field';
import { Stepper } from '@/components/Pickers';
import { Toggle } from '@/components/Toggle';
import { Screen, SectionHeader } from '@/components/Screen';
import { Segmented } from '@/components/Segmented';
import { formatDuration } from '@/lib/dates';
import type { GradeScale } from '@/lib/gpa';
import { remindersSupported, sendTestReminder } from '@/lib/notifications';
import { turnOnReminders } from '@/lib/useReminderSync';
import { useStore, type Role, type ThemePref } from '@/store/useStore';
import { spacing, useTheme } from '@/theme';

export default function Settings() {
  const { colors } = useTheme();
  const settings = useStore((s) => s.settings);
  const update = useStore((s) => s.updateSettings);
  const resetAll = useStore((s) => s.resetAll);
  const loadSample = useStore((s) => s.loadSampleData);
  const hasData = useStore((s) => s.courses.length > 0);
  const [name, setName] = useState(settings.name);
  const [university, setUniversity] = useState(settings.university);
  const [major, setMajor] = useState(settings.major);
  const [reminderMsg, setReminderMsg] = useState<string>();

  const saveProfile = () => update({ name: name.trim() || settings.name, university: university.trim(), major: major.trim() });

  return (
    <Screen back title="الإعدادات">
      <SectionHeader title="الملف الشخصي" />
      <Card style={{ gap: spacing.md }}>
        <Field label="الاسم" value={name} onChangeText={setName} onBlur={saveProfile} onEndEditing={saveProfile} />
        <Field label="الجامعة" value={university} onChangeText={setUniversity} onBlur={saveProfile} onEndEditing={saveProfile} />
        <Field label={settings.role === 'student' ? 'التخصص' : 'القسم'} value={major} onChangeText={setMajor} onBlur={saveProfile} onEndEditing={saveProfile} />
        <View style={{ gap: 6 }}>
          <AppText variant="label">الدور</AppText>
          <Segmented<Role>
            value={settings.role}
            onChange={(role) => update({ role })}
            options={[
              { value: 'student', label: 'طالب' },
              { value: 'professor', label: 'عضو هيئة تدريس' },
            ]}
          />
        </View>
      </Card>

      <SectionHeader title="المظهر" />
      <Card style={{ gap: spacing.md }}>
        <Segmented<ThemePref>
          value={settings.theme}
          onChange={(theme) => update({ theme })}
          options={[
            { value: 'system', label: 'تلقائي' },
            { value: 'light', label: 'فاتح' },
            { value: 'dark', label: 'داكن' },
          ]}
        />
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <View style={{ flex: 1 }}>
            <AppText variant="label">الاهتزاز عند اللمس</AppText>
            <AppText variant="caption" muted>
              ردة فعل لمسية خفيفة للأزرار
            </AppText>
          </View>
          <Toggle accessibilityLabel="الاهتزاز عند اللمس" value={settings.haptics} onValueChange={(haptics) => update({ haptics })} />
        </View>
      </Card>

      <SectionHeader title="التذكيرات" />
      <Card style={{ gap: spacing.md }}>
        {!remindersSupported ? (
          <AppText variant="caption" muted>
            التذكيرات متاحة في تطبيق الجوال (iOS وAndroid).
          </AppText>
        ) : (
          <>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <View style={{ flex: 1 }}>
                <AppText variant="label">تذكير بالمحاضرات والمواعيد</AppText>
                <AppText variant="caption" muted>
                  قبل المحاضرة، ومساء اليوم السابق للتسليم وصباحه، وقبل الاختبار بثلاثة أيام
                </AppText>
              </View>
              <Toggle
                accessibilityLabel="تذكير بالمحاضرات والمواعيد"
                value={settings.remindersEnabled}
                onValueChange={async (on) => {
                  setReminderMsg(undefined);
                  if (!on) return update({ remindersEnabled: false });
                  if (!(await turnOnReminders())) setReminderMsg('لم يُسمح بالإشعارات. فعّلها لتطبيق مذاكر من إعدادات الجوال.');
                }}
              />
            </View>
            {settings.remindersEnabled && (
              <View style={{ gap: 8 }}>
                <AppText variant="label">قبل المحاضرة بـ</AppText>
                <ChipRow>
                  {[5, 10, 15, 30, 60].map((m) => (
                    <Chip key={m} label={m === 60 ? 'ساعة' : `${m} دقائق`} selected={settings.lectureLeadMin === m} onPress={() => update({ lectureLeadMin: m })} />
                  ))}
                </ChipRow>
                <Button
                  title="أرسل تذكيراً تجريبياً"
                  variant="ghost"
                  icon="notifications-outline"
                  size="sm"
                  onPress={async () => setReminderMsg((await sendTestReminder()) ? 'سيصلك تذكير تجريبي خلال 5 ثوانٍ.' : 'لم يُسمح بالإشعارات.')}
                />
              </View>
            )}
            {reminderMsg && (
              <View style={{ gap: 6 }}>
                <AppText variant="caption" color={colors.info}>
                  {reminderMsg}
                </AppText>
                {reminderMsg.includes('إعدادات الجوال') && <Button title="فتح إعدادات الجوال" variant="secondary" size="sm" onPress={() => Linking.openSettings()} />}
              </View>
            )}
          </>
        )}
      </Card>

      <SectionHeader title="الدراسة" />
      <Card style={{ gap: spacing.md }}>
        <View style={{ gap: 6 }}>
          <AppText variant="label">الهدف اليومي للمذاكرة</AppText>
          <Stepper value={settings.dailyGoalMin} onChange={(dailyGoalMin) => update({ dailyGoalMin })} min={15} max={600} step={15} format={formatDuration} />
        </View>
        <View style={{ gap: 6 }}>
          <AppText variant="label">مدة الاستراحة</AppText>
          <Stepper value={settings.breakMin} onChange={(breakMin) => update({ breakMin })} min={1} max={30} format={(n) => `${n} دقائق`} />
        </View>
        <View style={{ gap: 6 }}>
          <AppText variant="label">نظام المعدل</AppText>
          <Segmented<GradeScale>
            value={settings.gradeScale}
            onChange={(gradeScale) => update({ gradeScale })}
            options={[
              { value: 5, label: 'من 5' },
              { value: 4, label: 'من 4' },
            ]}
          />
        </View>
      </Card>

      <SectionHeader title="البيانات والخصوصية" />
      <Card style={{ gap: spacing.md }}>
        <AppText variant="caption" muted>
          بياناتك محفوظة على جهازك فقط ولا تُرسل لأي خادم.
        </AppText>
        {!hasData && <Button title="تحميل جدول تجريبي" variant="secondary" icon="sparkles" onPress={loadSample} />}
        <Button title="الاشتراك والمدفوعات" variant="ghost" icon="diamond-outline" onPress={() => router.push('/pro')} />
        <Button
          title="حذف جميع البيانات"
          variant="danger"
          icon="trash-outline"
          onPress={() =>
            confirm('حذف جميع البيانات؟', 'سيُحذف كل شيء نهائياً ولا يمكن التراجع.', () => {
              resetAll();
              router.replace('/onboarding');
            })
          }
        />
      </Card>

      <AppText variant="tiny" muted center>
        مذاكر · الإصدار {Constants.expoConfig?.version ?? '1.0.0'} · صُنع بحب لطلاب الجامعات 💜
      </AppText>
    </Screen>
  );
}
