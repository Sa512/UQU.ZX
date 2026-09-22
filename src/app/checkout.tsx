import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Field } from '@/components/Field';
import { haptic } from '@/components/haptics';
import { Screen, SectionHeader } from '@/components/Screen';
import { formatShortDate } from '@/lib/dates';
import {
  availableMethods,
  detectBrand,
  digitsOnly,
  formatCardNumber,
  formatExpiry,
  METHOD_INFO,
  normalizeSaudiMobile,
  paymentGateway,
  PLANS,
  SANDBOX_DECLINE_CARD,
  SANDBOX_OTP,
  validateCard,
  vatBreakdown,
  type CardErrors,
  type PaymentMethod,
} from '@/lib/payments';
import { useStore } from '@/store/useStore';
import { radius, spacing, useTheme } from '@/theme';

const METHOD_ICON: Record<PaymentMethod, keyof typeof Ionicons.glyphMap> = {
  applepay: 'logo-apple',
  googlepay: 'logo-google',
  mada: 'card',
  card: 'card-outline',
  stcpay: 'phone-portrait-outline',
};

const BRAND_LABEL = { mada: 'مدى', visa: 'VISA', mastercard: 'Mastercard', amex: 'AMEX', unknown: '' } as const;

export default function Checkout() {
  const { colors } = useTheme();
  const params = useLocalSearchParams<{ plan?: string }>();
  const plan = PLANS.find((p) => p.id === params.plan) ?? PLANS[1];
  const activatePlan = useStore((s) => s.activatePlan);
  const methods = availableMethods();
  const [method, setMethod] = useState<PaymentMethod>(methods[0]);
  const [name, setName] = useState('');
  const [number, setNumber] = useState('');
  const [expiry, setExpiry] = useState('');
  const [cvv, setCvv] = useState('');
  const [errors, setErrors] = useState<CardErrors>({});
  const [mobile, setMobile] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [otp, setOtp] = useState('');
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string>();
  const [success, setSuccess] = useState<{ reference: string; until: number } | null>(null);
  const { base, vat, total } = vatBreakdown(plan.price);
  const brand = detectBrand(number);

  const pay = async () => {
    setFailure(undefined);
    const isCard = method === 'mada' || method === 'card';
    if (isCard) {
      const e = validateCard({ name, number, expiry, cvv }, method);
      setErrors(e);
      if (Object.keys(e).length) return haptic.warn();
    }
    if (method === 'stcpay') {
      if (!normalizeSaudiMobile(mobile)) return setFailure('اكتب رقم جوال سعودي صحيح يبدأ بـ 05');
      if (!otpSent) {
        setBusy(true);
        const r = await paymentGateway.requestOtp(mobile);
        setBusy(false);
        if (!r.ok) return setFailure(r.message);
        setOtpSent(true);
        return;
      }
      if (otp.length < 4) return setFailure('اكتب رمز التحقق المرسل إلى جوالك');
    }
    setBusy(true);
    const result = await paymentGateway.pay({
      plan,
      method,
      card: isCard ? { name, number, expiry, cvv } : undefined,
      mobile: method === 'stcpay' ? mobile : undefined,
      otp: method === 'stcpay' ? otp : undefined,
    });
    setBusy(false);
    if (!result.ok) {
      haptic.warn();
      return setFailure(result.message);
    }
    activatePlan({ plan: plan.id, amount: plan.price, method, reference: result.reference, last4: result.ok ? result.last4 : undefined }, plan.months);
    haptic.success();
    setSuccess({ reference: result.reference, until: useStore.getState().subscription.until ?? 0 });
  };

  if (success) {
    return (
      <Screen footer={<Button title="ابدأ الاستخدام" size="lg" onPress={() => router.dismissAll()} />}>
        <View style={{ alignItems: 'center', gap: spacing.md, paddingTop: 60 }}>
          <View style={{ width: 110, height: 110, borderRadius: 55, backgroundColor: colors.successSoft, alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name="checkmark-circle" size={70} color={colors.success} />
          </View>
          <AppText variant="title">تم الدفع بنجاح</AppText>
          <AppText muted center>
            أهلاً بك في مذاكر برو! اشتراكك فعّال حتى {formatShortDate(new Date(success.until))} {new Date(success.until).getFullYear()}.
          </AppText>
          <Card style={{ alignSelf: 'stretch', gap: 8 }}>
            <Row label="الخطة" value={plan.title} />
            <Row label="وسيلة الدفع" value={METHOD_INFO[method].title} />
            <Row label="المبلغ" value={`${total.toFixed(2)} ر.س`} />
            <Row label="رقم العملية" value={success.reference} />
          </Card>
        </View>
      </Screen>
    );
  }

  const payLabel =
    method === 'applepay'
      ? 'ادفع عبر Apple Pay'
      : method === 'googlepay'
        ? 'ادفع عبر Google Pay'
        : method === 'stcpay' && !otpSent
          ? 'أرسل رمز التحقق'
          : `ادفع ${total.toFixed(2)} ر.س`;

  return (
    <Screen
      back
      title="الدفع"
      subtitle="اتصال آمن ومشفّر"
      footer={
        <View style={{ gap: 8 }}>
          {failure && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: colors.dangerSoft, borderRadius: radius.md, padding: spacing.md }} accessibilityLiveRegion="assertive">
              <Ionicons name="alert-circle" size={20} color={colors.danger} />
              <AppText variant="label" color={colors.danger} style={{ flex: 1 }}>
                {failure}
              </AppText>
            </View>
          )}
          <Button title={payLabel} size="lg" icon={METHOD_ICON[method] === 'card' || METHOD_ICON[method] === 'card-outline' ? 'lock-closed' : METHOD_ICON[method]} loading={busy} onPress={pay} />
        </View>
      }
    >
      {paymentGateway.isSandbox && (
        <View style={{ flexDirection: 'row', gap: 8, backgroundColor: colors.infoSoft, borderRadius: radius.md, padding: spacing.md }}>
          <Ionicons name="flask" size={18} color={colors.info} />
          <AppText variant="caption" color={colors.info} style={{ flex: 1 }}>
            وضع تجريبي: لن يُخصم أي مبلغ. استخدم بطاقة 4111 1111 1111 1111 أو مدى 4406 4700 0000 0007، ورمز STC Pay {SANDBOX_OTP}. البطاقة {formatCardNumber(SANDBOX_DECLINE_CARD)} تُرفض لتجربة الخطأ.
          </AppText>
        </View>
      )}

      <Card style={{ gap: 8 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
          <Ionicons name="diamond" size={22} color={colors.warning} />
          <AppText variant="h3" style={{ flex: 1 }}>
            مذاكر برو · {plan.title}
          </AppText>
          <Pressable accessibilityRole="button" onPress={() => router.back()} hitSlop={8}>
            <AppText variant="label" color={colors.primary}>
              تغيير
            </AppText>
          </Pressable>
        </View>
        <View style={{ height: 1, backgroundColor: colors.border, marginVertical: 4 }} />
        <Row label="السعر قبل الضريبة" value={`${base.toFixed(2)} ر.س`} />
        <Row label="ضريبة القيمة المضافة (15%)" value={`${vat.toFixed(2)} ر.س`} />
        <Row label="الإجمالي" value={`${total.toFixed(2)} ر.س`} strong />
      </Card>

      <SectionHeader title="وسيلة الدفع" />
      <View style={{ gap: spacing.sm }} accessibilityRole="radiogroup">
        {methods.map((m) => {
          const on = m === method;
          return (
            <Pressable
              key={m}
              accessibilityRole="radio"
              accessibilityState={{ checked: on }}
              accessibilityLabel={METHOD_INFO[m].title}
              onPress={() => {
                haptic.tap();
                setMethod(m);
                setFailure(undefined);
                setErrors({});
              }}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: spacing.md,
                padding: spacing.md,
                borderRadius: radius.lg,
                borderWidth: 2,
                borderColor: on ? colors.primary : colors.border,
                backgroundColor: on ? colors.primarySoft : colors.surface,
              }}
            >
              <View style={{ width: 46, height: 32, borderRadius: 8, backgroundColor: m === 'applepay' ? '#000000' : m === 'stcpay' ? '#4F008C' : m === 'mada' ? '#259BD6' : m === 'googlepay' ? '#FFFFFF' : colors.surfaceAlt, borderWidth: m === 'googlepay' ? 1 : 0, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' }}>
                {m === 'mada' ? (
                  <AppText variant="tiny" color="#FFFFFF" weight="bold">
                    مدى
                  </AppText>
                ) : m === 'stcpay' ? (
                  <AppText variant="tiny" color="#FFFFFF" weight="bold">
                    stc
                  </AppText>
                ) : (
                  <Ionicons name={METHOD_ICON[m]} size={18} color={m === 'applepay' ? '#FFFFFF' : m === 'googlepay' ? '#4285F4' : colors.text} />
                )}
              </View>
              <View style={{ flex: 1 }}>
                <AppText variant="h3">{METHOD_INFO[m].title}</AppText>
                <AppText variant="caption" muted>
                  {METHOD_INFO[m].subtitle}
                </AppText>
              </View>
              <Ionicons name={on ? 'radio-button-on' : 'radio-button-off'} size={22} color={on ? colors.primary : colors.textMuted} />
            </Pressable>
          );
        })}
      </View>

      {(method === 'mada' || method === 'card') && (
        <Card style={{ gap: spacing.md }}>
          <Field label="الاسم على البطاقة" placeholder="ABDULLAH SALEH" autoCapitalize="characters" autoComplete="cc-name" value={name} onChangeText={setName} error={errors.name} ltr />
          <View style={{ gap: 6 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <AppText variant="label">رقم البطاقة</AppText>
              {brand !== 'unknown' && (
                <View style={{ backgroundColor: brand === 'mada' ? '#259BD6' : colors.surfaceAlt, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 2 }}>
                  <AppText variant="tiny" color={brand === 'mada' ? '#FFFFFF' : colors.text} weight="bold">
                    {BRAND_LABEL[brand]}
                  </AppText>
                </View>
              )}
            </View>
            <Field
              accessibilityLabel="رقم البطاقة"
              placeholder="0000 0000 0000 0000"
              keyboardType="number-pad"
              autoComplete="cc-number"
              value={number}
              onChangeText={(t) => setNumber(formatCardNumber(t))}
              error={errors.number}
              maxLength={23}
              ltr
            />
          </View>
          <View style={{ flexDirection: 'row', gap: spacing.md }}>
            <View style={{ flex: 1 }}>
              <Field label="تاريخ الانتهاء" placeholder="MM/YY" keyboardType="number-pad" autoComplete="cc-exp" value={expiry} onChangeText={(t) => setExpiry(formatExpiry(t))} error={errors.expiry} maxLength={5} ltr />
            </View>
            <View style={{ flex: 1 }}>
              <Field label="رمز الأمان" placeholder="CVV" keyboardType="number-pad" autoComplete="cc-csc" secureTextEntry value={cvv} onChangeText={(t) => setCvv(digitsOnly(t).slice(0, 4))} error={errors.cvv} maxLength={4} ltr />
            </View>
          </View>
        </Card>
      )}

      {method === 'stcpay' && (
        <Card style={{ gap: spacing.md }}>
          <Field label="رقم الجوال المسجّل في STC Pay" placeholder="05XXXXXXXX" keyboardType="phone-pad" autoComplete="tel" value={mobile} onChangeText={(t) => { setMobile(t); setOtpSent(false); }} maxLength={14} ltr />
          {otpSent && <Field label="رمز التحقق" placeholder="••••••" keyboardType="number-pad" autoComplete="one-time-code" value={otp} onChangeText={(t) => setOtp(digitsOnly(t).slice(0, 6))} hint="أرسلنا رمزاً مكوناً من 6 أرقام إلى جوالك" maxLength={6} ltr />}
        </Card>
      )}

      {(method === 'applepay' || method === 'googlepay') && (
        <AppText variant="caption" muted center>
          ستظهر نافذة {METHOD_INFO[method].title} لتأكيد الدفع باستخدام البطاقة المحفوظة في محفظتك.
        </AppText>
      )}

      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
        <Ionicons name="shield-checkmark" size={16} color={colors.success} />
        <AppText variant="tiny" muted>
          لا نحفظ بيانات بطاقتك على الجهاز · متوافق مع PCI DSS عبر بوابة الدفع
        </AppText>
      </View>
    </Screen>
  );
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}>
      <AppText variant={strong ? 'h3' : 'caption'} muted={!strong}>
        {label}
      </AppText>
      <AppText variant={strong ? 'h3' : 'label'}>{value}</AppText>
    </View>
  );
}
