import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Field } from '@/components/Field';
import { haptic } from '@/components/haptics';
import { Screen } from '@/components/Screen';
import { Segmented } from '@/components/Segmented';
import { UniversityField } from '@/components/UniversityField';
import { emailKind, isEmail, signupProblem, type AccountRole, type Profile } from '@/lib/accounts';
import { cloud } from '@/lib/cloud';
import { DEMO_CODE } from '@/lib/cloud/demoApi';
import { useStore } from '@/store/useStore';
import { spacing, useTheme } from '@/theme';

type Mode = 'signin' | 'signup' | 'verify' | 'forgot' | 'reset' | 'profile';

/** بوابة الدخول: حساب بالإيميل الجامعي للطالب وعضو هيئة التدريس. */
export default function Auth() {
  const { colors } = useTheme();
  const settings = useStore((s) => s.settings);
  const setAccount = useStore((s) => s.setAccount);
  // «تغيير كلمة المرور» من الإعدادات يفتح هنا على الاستعادة بالإيميل نفسه
  const params = useLocalSearchParams<{ mode?: string; email?: string }>();
  const [mode, setMode] = useState<Mode>(params.mode === 'forgot' ? 'forgot' : 'signup');
  const [email, setEmail] = useState(params.email ?? '');
  const [password, setPassword] = useState('');
  const [name, setName] = useState(settings.name);
  const [role, setRole] = useState<AccountRole>(settings.role);
  const [university, setUniversity] = useState(settings.university);
  const [code, setCode] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string }>();

  const detected = emailKind(email);
  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setMsg(undefined);
    try {
      await fn();
    } catch (e) {
      haptic.warn();
      setMsg({ ok: false, text: (e as Error).message });
    } finally {
      setBusy(false);
    }
  };

  const finish = (p: Profile) => {
    setAccount(p);
    haptic.success();
    // حساب مختلف عن آخر حساب على الجهاز يبدأ من جديد (setAccount يمسح البيانات المحلية)
    if (useStore.getState().settings.onboarded) router.replace('/');
    else router.replace({ pathname: '/onboarding', params: { step: '2' } });
  };
  const afterSession = async (fromSignup: boolean) => {
    if (fromSignup) return finish(await cloud.completeProfile(name, role, university));
    const p = await cloud.myProfile();
    if (p) finish(p);
    else setMode('profile');
  };

  const signup = () =>
    run(async () => {
      const problem = name.trim().length < 2 ? 'اكتب اسمك الكامل.' : signupProblem(email, password, role);
      if (problem) throw new Error(problem);
      await cloud.signUp(email, password);
      setCode('');
      setMode('verify');
    });

  const title = { signin: 'تسجيل الدخول', signup: 'حساب جديد', verify: 'تأكيد الإيميل', forgot: 'نسيت كلمة المرور', reset: 'كلمة مرور جديدة', profile: 'أكمل ملفك' }[mode];

  return (
    <Screen back={!!params.mode} title={title} subtitle="بإيميلك الجامعي · للطالب وعضو هيئة التدريس">
      {(mode === 'signin' || mode === 'signup') && (
        <Segmented<'signup' | 'signin'>
          value={mode}
          onChange={(m) => { setMode(m); setMsg(undefined); }}
          options={[
            { value: 'signup', label: 'حساب جديد' },
            { value: 'signin', label: 'لدي حساب' },
          ]}
        />
      )}

      {mode === 'signup' && (
        <Card style={{ gap: spacing.md }}>
          <View style={{ gap: 6 }}>
            <AppText variant="label">أنا</AppText>
            <Segmented<AccountRole>
              value={role}
              onChange={setRole}
              options={[
                { value: 'student', label: 'طالب' },
                { value: 'professor', label: 'عضو هيئة تدريس' },
              ]}
            />
          </View>
          <Field label="الاسم الكامل" placeholder={role === 'professor' ? 'مثال: د. سارة الحربي' : 'مثال: نورة العتيبي'} value={name} onChangeText={setName} />
          <Field label="الإيميل الجامعي" placeholder={role === 'professor' ? 'name@uqu.edu.sa' : 's44xxxxxxx@st.uqu.edu.sa'} value={email} onChangeText={setEmail} autoCapitalize="none" autoCorrect={false} keyboardType="email-address" ltr />
          {isEmail(email) && detected.kind !== 'not_university' && (
            <AppText variant="caption" color={role === 'professor' && detected.kind === 'student' ? colors.danger : colors.success}>
              {detected.kind === 'student' ? '✓ إيميل طالب' : detected.kind === 'staff' ? '✓ إيميل منسوبين' : '✓ إيميل جامعي'}
              {detected.university ? ` · ${detected.university}` : ''}
              {role === 'professor' && detected.kind === 'unknown' ? ' · يظهر اسمك للطلاب بعد موافقة المشرف' : ''}
            </AppText>
          )}
          {isEmail(email) && !detected.university && detected.kind !== 'not_university' && <UniversityField value={university} onChange={setUniversity} />}
          <Field label="كلمة المرور" placeholder="8 خانات على الأقل" value={password} onChangeText={setPassword} secureTextEntry={!showPw} ltr />
          <ShowPassword on={showPw} onToggle={() => setShowPw(!showPw)} />
          <Button title="إنشاء الحساب" icon="person-add" loading={busy} onPress={signup} />
          <AppText variant="tiny" muted>
            نحفظ اسمك وإيميلك الجامعي وجامعتك ودورك فقط. لا نطلب تاريخ ميلادك ولا كلمة مرور بوابة الجامعة.
          </AppText>
        </Card>
      )}

      {mode === 'signin' && (
        <Card style={{ gap: spacing.md }}>
          <Field label="الإيميل الجامعي" value={email} onChangeText={setEmail} autoCapitalize="none" autoCorrect={false} keyboardType="email-address" ltr />
          <Field label="كلمة المرور" value={password} onChangeText={setPassword} secureTextEntry={!showPw} ltr />
          <ShowPassword on={showPw} onToggle={() => setShowPw(!showPw)} />
          <Button title="دخول" icon="log-in" loading={busy} onPress={() => run(async () => { await cloud.signIn(email, password); await afterSession(false); })} />
          <Button title="نسيت كلمة المرور؟" variant="ghost" size="sm" onPress={() => { setMode('forgot'); setMsg(undefined); }} />
        </Card>
      )}

      {mode === 'verify' && (
        <Card style={{ gap: spacing.md }}>
          <View style={{ alignItems: 'center', gap: spacing.sm }}>
            <Ionicons name="mail-open" size={40} color={colors.primary} />
            <AppText variant="body" center>
              أرسلنا رمزاً من 6 أرقام إلى{'\n'}
              <AppText variant="label">{email.trim()}</AppText>
            </AppText>
          </View>
          <Field label="رمز التأكيد" placeholder="••••••" value={code} onChangeText={(t) => setCode(t.replace(/\D/g, ''))} keyboardType="number-pad" maxLength={6} ltr />
          <Button title="تأكيد" icon="checkmark-circle" loading={busy} disabled={code.length !== 6} onPress={() => run(async () => { await cloud.verifyEmail(email, code); await afterSession(true); })} />
          <Button title="إعادة إرسال الرمز" variant="ghost" size="sm" onPress={() => run(async () => { await cloud.signUp(email, password); setMsg({ ok: true, text: 'أرسلنا رمزاً جديداً ✓' }); })} />
          <Button title="تعديل الإيميل" variant="ghost" size="sm" onPress={() => setMode('signup')} />
        </Card>
      )}

      {mode === 'forgot' && (
        <Card style={{ gap: spacing.md }}>
          <Field label="الإيميل الجامعي" value={email} onChangeText={setEmail} autoCapitalize="none" autoCorrect={false} keyboardType="email-address" ltr />
          <Button title="أرسل رمز الاستعادة" icon="mail" loading={busy} disabled={!isEmail(email)} onPress={() => run(async () => { await cloud.sendReset(email); setCode(''); setPassword(''); setMode('reset'); })} />
          <Button title="رجوع لتسجيل الدخول" variant="ghost" size="sm" onPress={() => setMode('signin')} />
        </Card>
      )}

      {mode === 'reset' && (
        <Card style={{ gap: spacing.md }}>
          <AppText variant="caption" muted>
            أدخل الرمز المرسل إلى {email.trim()} وكلمة مرور جديدة.
          </AppText>
          <Field label="الرمز" value={code} onChangeText={(t) => setCode(t.replace(/\D/g, ''))} keyboardType="number-pad" maxLength={6} ltr />
          <Field label="كلمة المرور الجديدة" placeholder="8 خانات على الأقل" value={password} onChangeText={setPassword} secureTextEntry={!showPw} ltr />
          <ShowPassword on={showPw} onToggle={() => setShowPw(!showPw)} />
          <Button title="حفظ والدخول" icon="key" loading={busy} disabled={code.length !== 6 || password.length < 8} onPress={() => run(async () => { await cloud.resetPassword(email, code, password); await afterSession(false); })} />
        </Card>
      )}

      {mode === 'profile' && (
        <Card style={{ gap: spacing.md }}>
          <Segmented<AccountRole>
            value={role}
            onChange={setRole}
            options={[
              { value: 'student', label: 'طالب' },
              { value: 'professor', label: 'عضو هيئة تدريس' },
            ]}
          />
          <Field label="الاسم الكامل" value={name} onChangeText={setName} />
          <UniversityField value={university} onChange={setUniversity} />
          <Button title="متابعة" icon="arrow-back" loading={busy} onPress={() => run(async () => finish(await cloud.completeProfile(name, role, university)))} />
        </Card>
      )}

      {msg && (
        <AppText variant="label" center color={msg.ok ? colors.success : colors.danger}>
          {msg.text}
        </AppText>
      )}
      {!cloud.real && (mode === 'verify' || mode === 'reset') && (
        <AppText variant="caption" muted center>
          نسخة تجريبية بلا إرسال إيميل فعلي: الرمز {DEMO_CODE}
        </AppText>
      )}
    </Screen>
  );
}

function ShowPassword({ on, onToggle }: { on: boolean; onToggle: () => void }) {
  const { colors } = useTheme();
  return (
    <Pressable accessibilityRole="switch" accessibilityState={{ checked: on }} accessibilityLabel="إظهار كلمة المرور" hitSlop={8} onPress={onToggle} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', marginTop: -6 }}>
      <Ionicons name={on ? 'eye-off-outline' : 'eye-outline'} size={16} color={colors.primary} />
      <AppText variant="caption" color={colors.primary}>
        {on ? 'إخفاء كلمة المرور' : 'إظهار كلمة المرور'}
      </AppText>
    </Pressable>
  );
}
