import { router } from 'expo-router';
import { useStore } from '@/store/useStore';
import { Card } from './Card';
import { EmptyState } from './EmptyState';
import { Screen } from './Screen';

/** للميزات السحابية: تظهر بدل الشاشة إن لم يسجّل المستخدم (في وضع الاستخدام بلا حساب). */
export function SignInNeeded({ title, children }: { title: string; children: React.ReactNode }) {
  const signedIn = useStore((s) => !!s.account);
  if (signedIn) return <>{children}</>;
  return (
    <Screen back title={title}>
      <Card padded={false}>
        <EmptyState
          icon="person-circle-outline"
          title="تحتاج حساباً بإيميلك الجامعي"
          message="هذه الميزة تعمل مع دكاترتك وزملائك، فتحتاج تسجيل الدخول. بقية التطبيق يعمل بدون حساب."
          action={{ title: 'تسجيل الدخول', onPress: () => router.push('/auth') }}
        />
      </Card>
    </Screen>
  );
}
