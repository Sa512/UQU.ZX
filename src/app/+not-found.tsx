import { router } from 'expo-router';
import { Button } from '@/components/Button';
import { EmptyState } from '@/components/EmptyState';
import { Screen } from '@/components/Screen';

export default function NotFound() {
  return (
    <Screen>
      <EmptyState icon="compass-outline" title="الصفحة غير موجودة" message="يبدو أن الرابط غير صحيح." />
      <Button title="العودة للرئيسية" onPress={() => router.replace('/')} />
    </Screen>
  );
}
