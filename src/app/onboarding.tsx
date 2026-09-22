import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { Field } from '@/components/Field';
import { haptic } from '@/components/haptics';
import { Segmented } from '@/components/Segmented';
import type { GradeScale } from '@/lib/gpa';
import { useStore, type Role } from '@/store/useStore';
import { radius, spacing, useTheme } from '@/theme';

const features: { icon: keyof typeof Ionicons.glyphMap; title: string; text: string }[] = [
  { icon: 'calendar', title: 'جدولك في مكان واحد', text: 'محاضراتك ومعاملك وساعاتك المكتبية مرتبة يوماً بيوم.' },
  { icon: 'timer', title: 'ذاكر بتركيز', text: 'مؤقت بومودورو يحسب وقت مذاكرتك لكل مقرر.' },
  { icon: 'albums', title: 'بطاقات مراجعة ذكية', text: 'تكرار متباعد يثبّت المعلومة قبل الاختبار.' },
  { icon: 'calculator', title: 'احسب معدلك', text: 'على نظام الخمسة أو الأربعة وخطّط لمعدلك المستهدف.' },
];

function RoleCard({ role, selected, onPress }: { role: Role; selected: boolean; onPress: () => void }) {
  const { colors } = useTheme();
  const info =
    role === 'student'
      ? { icon: 'school' as const, title: 'أنا طالب', text: 'أنظّم مذاكرتي وواجباتي واختباراتي' }
      : { icon: 'briefcase' as const, title: 'أنا عضو هيئة تدريس', text: 'أنظّم محاضراتي وساعاتي المكتبية والتصحيح' };
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ checked: selected }}
      accessibilityLabel={info.title}
      onPress={() => {
        haptic.tap();
        onPress();
      }}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.md,
        padding: spacing.lg,
        borderRadius: radius.lg,
        borderWidth: 2,
        borderColor: selected ? colors.primary : colors.border,
        backgroundColor: selected ? colors.primarySoft : colors.surface,
      }}
    >
      <View style={{ width: 52, height: 52, borderRadius: 16, backgroundColor: selected ? colors.fill : colors.surfaceAlt, alignItems: 'center', justifyContent: 'center' }}>
        <Ionicons name={info.icon} size={26} color={selected ? '#FFFFFF' : colors.textMuted} />
      </View>
      <View style={{ flex: 1 }}>
        <AppText variant="h3">{info.title}</AppText>
        <AppText variant="caption" muted>
          {info.text}
        </AppText>
      </View>
      <Ionicons name={selected ? 'radio-button-on' : 'radio-button-off'} size={24} color={selected ? colors.primary : colors.border} />
    </Pressable>
  );
}

export default function Onboarding() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const update = useStore((s) => s.updateSettings);
  const loadSample = useStore((s) => s.loadSampleData);
  const current = useStore((s) => s.settings);
  const [step, setStep] = useState(0);
  const [role, setRole] = useState<Role>(current.role);
  const [name, setName] = useState(current.name);
  const [university, setUniversity] = useState(current.university || 'جامعة أم القرى');
  const [major, setMajor] = useState(current.major);
  const [scale, setScale] = useState<GradeScale>(current.gradeScale);
  const [nameError, setNameError] = useState<string>();

  const finish = (withSample: boolean) => {
    update({ role, name: name.trim(), university: university.trim(), major: major.trim(), gradeScale: scale, onboarded: true });
    if (withSample) loadSample();
    haptic.success();
    router.replace('/');
  };

  if (step === 0) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg }}>
        <LinearGradient colors={colors.gradient} start={{ x: 1, y: 0 }} end={{ x: 0, y: 1 }} style={{ paddingTop: insets.top + 36, paddingBottom: 44, paddingHorizontal: spacing.xl, borderBottomLeftRadius: 36, borderBottomRightRadius: 36 }}>
          <View style={{ width: 72, height: 72, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.18)', alignItems: 'center', justifyContent: 'center', marginBottom: 18 }}>
            <Ionicons name="book" size={36} color="#FFFFFF" />
          </View>
          <AppText variant="display" color="#FFFFFF">
            مذاكر
          </AppText>
          <AppText variant="h3" color="rgba(255,255,255,0.88)" weight="regular">
            رفيقك الجامعي للتنظيم والمذاكرة والتفوّق
          </AppText>
        </LinearGradient>
        <ScrollView contentContainerStyle={{ padding: spacing.xl, gap: spacing.lg }}>
          {features.map((f) => (
            <View key={f.title} style={{ flexDirection: 'row', gap: spacing.md, alignItems: 'center' }}>
              <View style={{ width: 48, height: 48, borderRadius: 14, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name={f.icon} size={24} color={colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <AppText variant="h3">{f.title}</AppText>
                <AppText variant="caption" muted>
                  {f.text}
                </AppText>
              </View>
            </View>
          ))}
        </ScrollView>
        <View style={{ padding: spacing.xl, paddingBottom: insets.bottom + spacing.lg }}>
          <Button title="لنبدأ" size="lg" icon="arrow-back" onPress={() => setStep(1)} />
        </View>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg, paddingTop: insets.top }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.xl, paddingVertical: spacing.md }}>
        <Pressable accessibilityRole="button" accessibilityLabel="رجوع" hitSlop={10} onPress={() => setStep(step - 1)}>
          <Ionicons name="chevron-forward" size={26} color={colors.text} />
        </Pressable>
        <View style={{ flex: 1, flexDirection: 'row', gap: 6 }}>
          {[1, 2].map((i) => (
            <View key={i} style={{ flex: 1, height: 6, borderRadius: 3, backgroundColor: i <= step ? colors.primary : colors.surfaceAlt }} />
          ))}
        </View>
        <AppText variant="caption" muted>
          {step} / 2
        </AppText>
      </View>

      <ScrollView contentContainerStyle={{ padding: spacing.xl, gap: spacing.lg }} keyboardShouldPersistTaps="handled">
        {step === 1 ? (
          <>
            <AppText variant="title">من أنت؟</AppText>
            <AppText muted>نخصّص لك التطبيق حسب دورك في الجامعة. يمكنك تغييره لاحقاً من الإعدادات.</AppText>
            <RoleCard role="student" selected={role === 'student'} onPress={() => setRole('student')} />
            <RoleCard role="professor" selected={role === 'professor'} onPress={() => setRole('professor')} />
          </>
        ) : (
          <>
            <AppText variant="title">عرّفنا بنفسك</AppText>
            <Field
              label="الاسم"
              placeholder={role === 'student' ? 'مثال: عبدالله' : 'مثال: د. سارة'}
              value={name}
              onChangeText={(t) => {
                setName(t);
                setNameError(undefined);
              }}
              error={nameError}
              autoFocus
              returnKeyType="next"
            />
            <Field label="الجامعة" placeholder="اسم جامعتك" value={university} onChangeText={setUniversity} />
            <Field label={role === 'student' ? 'التخصص' : 'القسم'} placeholder={role === 'student' ? 'مثال: علوم الحاسب' : 'مثال: قسم الرياضيات'} value={major} onChangeText={setMajor} />
            <View style={{ gap: 6 }}>
              <AppText variant="label">نظام المعدل في جامعتك</AppText>
              <Segmented<GradeScale>
                value={scale}
                onChange={setScale}
                options={[
                  { value: 5, label: 'من 5' },
                  { value: 4, label: 'من 4' },
                ]}
              />
            </View>
          </>
        )}
      </ScrollView>

      <View style={{ padding: spacing.xl, paddingBottom: insets.bottom + spacing.lg, gap: spacing.sm }}>
        {step === 1 ? (
          <Button title="التالي" size="lg" icon="arrow-back" onPress={() => setStep(2)} />
        ) : (
          <>
            <Button
              title="ابدأ بجدول تجريبي"
              size="lg"
              icon="sparkles"
              onPress={() => (name.trim().length < 2 ? setNameError('اكتب اسمك (حرفان على الأقل)') : finish(true))}
            />
            <Button
              title="ابدأ من الصفر"
              variant="ghost"
              onPress={() => (name.trim().length < 2 ? setNameError('اكتب اسمك (حرفان على الأقل)') : finish(false))}
            />
          </>
        )}
      </View>
    </View>
  );
}
