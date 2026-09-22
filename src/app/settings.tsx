import { router } from 'expo-router';
import Constants from 'expo-constants';
import { useState } from 'react';
import { Switch, View } from 'react-native';
import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { confirm } from '@/components/confirm';
import { Field } from '@/components/Field';
import { Stepper } from '@/components/Pickers';
import { Screen, SectionHeader } from '@/components/Screen';
import { Segmented } from '@/components/Segmented';
import { formatDuration } from '@/lib/dates';
import type { GradeScale } from '@/lib/gpa';
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
          <Switch
            accessibilityLabel="الاهتزاز عند اللمس"
            value={settings.haptics}
            onValueChange={(haptics) => update({ haptics })}
            trackColor={{ true: colors.primary, false: colors.border }}
            thumbColor="#FFFFFF"
          />
        </View>
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
