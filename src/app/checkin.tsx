import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Field } from '@/components/Field';
import { haptic } from '@/components/haptics';
import { QrScanner } from '@/components/QrScanner';
import { Screen } from '@/components/Screen';
import { cloud } from '@/lib/cloud';
import { latinDigits } from '@/lib/csv';
import { parseQr } from '@/lib/officeHours';
import { useStore } from '@/store/useStore';
import { radius, spacing, useTheme } from '@/theme';

export default function StudentCheckin() {
  const { colors } = useTheme();
  // يدعم الفتح من رابط الـ QR مباشرة: mudhaker://checkin?c=…&n=…
  const params = useLocalSearchParams<{ c?: string; n?: string }>();
  const settings = useStore((s) => s.settings);
  const update = useStore((s) => s.updateSettings);
  const [name, setName] = useState(settings.name);
  const [uniId, setUniId] = useState(settings.uniId);
  const [typed, setTyped] = useState(params.c && params.n ? `${params.c} ${params.n}` : '');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; text: string }>();
  const profileOk = name.trim().length >= 2 && /^\d{4,12}$/.test(latinDigits(uniId.trim()));

  const submit = async (raw: string) => {
    const q = parseQr(raw);
    if (!q.code || !q.nonce) return setResult({ ok: false, text: 'هذا ليس رمز تحضير. امسح الرمز الظاهر على شاشة الدكتور.' });
    if (!profileOk) return setResult({ ok: false, text: 'اكتب اسمك ورقمك الجامعي أولاً.' });
    setBusy(true);
    setResult(undefined);
    const id = latinDigits(uniId.trim());
    update({ uniId: id, name: settings.name || name.trim() });
    try {
      const r = await cloud.checkIn(q.code, q.nonce, id, name.trim());
      haptic.success();
      setResult({ ok: true, text: `تم تحضيرك في ${r.label} ✓` });
    } catch (e) {
      haptic.warn();
      const msg = (e as Error).message;
      setResult({ ok: msg.includes('✓'), text: msg });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen back title="التحضير بالـ QR" subtitle="امسح الرمز الظاهر على شاشة الدكتور">
      <Card style={{ gap: spacing.md }}>
        <AppText variant="h3">بياناتك</AppText>
        <Field label="الاسم" value={name} onChangeText={setName} />
        <Field label="الرقم الجامعي" value={uniId} onChangeText={setUniId} keyboardType="number-pad" ltr />
      </Card>

      {result?.ok ? (
        <View style={{ alignItems: 'center', gap: spacing.md, padding: spacing.xl, backgroundColor: colors.successSoft, borderRadius: radius.xl }}>
          <Ionicons name="checkmark-circle" size={64} color={colors.success} />
          <AppText variant="h2" center>
            {result.text}
          </AppText>
        </View>
      ) : (
        <>
          {profileOk ? <QrScanner onScan={(d) => !busy && submit(d)} /> : null}
          <Card style={{ gap: spacing.sm }}>
            <AppText variant="caption" muted>
              أو اكتب الرمز الظاهر تحت الـ QR (مثال: AB2CD3 · XY7K2M9P)
            </AppText>
            <Field placeholder="الرمز" value={typed} onChangeText={setTyped} autoCapitalize="characters" ltr />
            <Button title="تحضير" icon="checkmark-done" loading={busy} disabled={!typed.trim()} onPress={() => submit(typed)} />
          </Card>
        </>
      )}
      {result && !result.ok && (
        <AppText variant="label" center color={colors.danger}>
          {result.text}
        </AppText>
      )}
      {!cloud.real && (
        <AppText variant="tiny" muted center>
          وضع تجريبي: التحضير يعمل على هذا الجهاز فقط حتى يُربط الخادم.
        </AppText>
      )}
    </Screen>
  );
}
