import { router } from 'expo-router';
import { featureOff } from '@/lib/appConfig';
import type { AppFeature } from '@/lib/cloud/types';
import { useStore } from '@/store/useStore';
import { Card } from './Card';
import { EmptyState } from './EmptyState';
import { Screen } from './Screen';

/**
 * للميزات السحابية: تظهر بدل الشاشة إن لم يسجّل المستخدم (في وضع الاستخدام بلا حساب)،
 * أو إن أوقف المشرف الميزة مؤقتاً (التحكم الطارئ / الصيانة).
 */
export function SignInNeeded({ title, feature, children }: { title: string; feature?: AppFeature; children: React.ReactNode }) {
  const signedIn = useStore((s) => !!s.account);
  const paused = useStore((s) => !!feature && !!s.remoteConfig && featureOff(s.remoteConfig, feature));
  const message = useStore((s) => s.remoteConfig?.maintenance_message);
  if (paused) {
    return (
      <Screen back title={title}>
        <Card padded={false}>
          <EmptyState icon="construct-outline" title="متوقفة مؤقتاً" message={message || 'نعمل على تحسينها وترجع قريباً. باقي التطبيق يعمل كالمعتاد.'} />
        </Card>
      </Screen>
    );
  }
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
