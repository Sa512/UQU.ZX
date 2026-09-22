import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { confirm } from '@/components/confirm';
import { haptic } from '@/components/haptics';
import { Pill } from '@/components/Rows';
import { Screen } from '@/components/Screen';
import { formatShortDate } from '@/lib/dates';
import { METHOD_INFO, PLANS, type PlanId } from '@/lib/payments';
import { FREE_LIMITS, isPro, useStore } from '@/store/useStore';
import { radius, spacing, useTheme } from '@/theme';

const PERKS: { icon: keyof typeof Ionicons.glyphMap; text: string }[] = [
  { icon: 'library', text: 'مقررات بلا حدود (المجاني ' + FREE_LIMITS.courses + ')' },
  { icon: 'albums', text: 'مجموعات بطاقات بلا حدود (المجاني ' + FREE_LIMITS.decks + ')' },
  { icon: 'stats-chart', text: 'تحليل وقت المذاكرة لكل مقرر' },
  { icon: 'heart', text: 'تدعم تطوير مذاكر لخدمة الطلاب' },
];

export default function Pro() {
  const { colors } = useTheme();
  const sub = useStore((s) => s.subscription);
  const transactions = useStore((s) => s.transactions);
  const cancel = useStore((s) => s.cancelSubscription);
  const [plan, setPlan] = useState<PlanId>('term');
  const active = isPro(sub);
  const selected = PLANS.find((p) => p.id === plan)!;

  return (
    <Screen
      close
      footer={
        active ? undefined : (
          <View style={{ gap: 6 }}>
            <Button title={`متابعة الدفع · ${selected.price.toFixed(2)} ر.س`} size="lg" icon="lock-closed" onPress={() => router.push({ pathname: '/checkout', params: { plan } })} />
            <AppText variant="tiny" muted center>
              الأسعار شاملة ضريبة القيمة المضافة 15% · دفع لمرة واحدة بلا تجديد تلقائي
            </AppText>
          </View>
        )
      }
    >
      <LinearGradient colors={['#D97706', '#EA580C']} start={{ x: 1, y: 0 }} end={{ x: 0, y: 1 }} style={{ borderRadius: radius.xl, padding: spacing.xl, gap: spacing.sm }}>
        <Ionicons name="diamond" size={36} color="#FFFFFF" />
        <AppText variant="title" color="#FFFFFF">
          مذاكر برو
        </AppText>
        <AppText color="rgba(255,255,255,0.92)">كل أدوات التفوق بلا حدود، بسعر يناسب ميزانية الطالب.</AppText>
      </LinearGradient>

      <Card style={{ gap: spacing.md }}>
        {PERKS.map((p) => (
          <View key={p.text} style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
            <Ionicons name={p.icon} size={20} color={colors.warning} />
            <AppText variant="label" style={{ flex: 1 }}>
              {p.text}
            </AppText>
          </View>
        ))}
      </Card>

      {active && sub.until ? (
        <Card style={{ gap: spacing.md, backgroundColor: colors.successSoft, borderColor: 'transparent' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
            <Ionicons name="checkmark-circle" size={24} color={colors.success} />
            <AppText variant="h3">اشتراكك فعّال حتى {formatShortDate(new Date(sub.until))} {new Date(sub.until).getFullYear()}</AppText>
          </View>
          <Button title="تمديد الاشتراك" variant="secondary" onPress={() => router.push({ pathname: '/checkout', params: { plan: 'term' } })} />
          <Button
            title="إلغاء الاشتراك"
            variant="ghost"
            onPress={() => confirm('إلغاء الاشتراك؟', 'ستعود للخطة المجانية فوراً.', cancel, 'إلغاء الاشتراك')}
          />
        </Card>
      ) : (
        <View style={{ gap: spacing.sm }} accessibilityRole="radiogroup">
          {PLANS.map((p) => {
            const on = p.id === plan;
            return (
              <Pressable
                key={p.id}
                accessibilityRole="radio"
                accessibilityState={{ checked: on }}
                accessibilityLabel={`${p.title} ${p.price} ريال`}
                onPress={() => {
                  haptic.tap();
                  setPlan(p.id);
                }}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: spacing.md,
                  padding: spacing.lg,
                  borderRadius: radius.lg,
                  borderWidth: 2,
                  borderColor: on ? colors.primary : colors.border,
                  backgroundColor: on ? colors.primarySoft : colors.surface,
                }}
              >
                <Ionicons name={on ? 'radio-button-on' : 'radio-button-off'} size={24} color={on ? colors.primary : colors.textMuted} />
                <View style={{ flex: 1, gap: 2 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <AppText variant="h3">{p.title}</AppText>
                    {p.badge && <Pill label={p.badge} tone="success" />}
                  </View>
                  <AppText variant="caption" muted>
                    {p.note ?? `${p.months} شهر`}
                  </AppText>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <AppText variant="h2">{p.price.toFixed(2)}</AppText>
                  <AppText variant="tiny" muted>
                    ر.س
                  </AppText>
                </View>
              </Pressable>
            );
          })}
        </View>
      )}

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'center' }}>
        {(['applepay', 'mada', 'stcpay', 'card'] as const).map((m) => (
          <Pill key={m} label={METHOD_INFO[m].title} tone="muted" />
        ))}
      </View>

      {transactions.length > 0 && (
        <Card style={{ gap: spacing.sm }}>
          <AppText variant="h3">سجل المدفوعات</AppText>
          {transactions.slice(0, 5).map((t) => (
            <View key={t.id} style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}>
              <AppText variant="caption">
                {PLANS.find((p) => p.id === t.plan)?.title} · {METHOD_INFO[t.method].title}
                {t.last4 ? ` •••• ${t.last4}` : ''}
              </AppText>
              <AppText variant="caption" muted>
                {t.amount.toFixed(2)} ر.س · {formatShortDate(new Date(t.at))}
              </AppText>
            </View>
          ))}
        </Card>
      )}
    </Screen>
  );
}
