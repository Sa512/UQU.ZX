import { Ionicons } from '@expo/vector-icons';
import type { ErrorBoundaryProps } from 'expo-router';
import { router, usePathname } from 'expo-router';
import { useEffect } from 'react';
import { View } from 'react-native';
import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { APP_INFO } from '@/content/app';
import { reportError } from '@/lib/errorReport';
import { spacing, useTheme } from '@/theme';

/** شاشة الخطأ بالعربي بدل شاشة Expo الافتراضية، ومعها بلاغ مجهول الهوية. */
export function AppErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  const { colors } = useTheme();
  const path = usePathname();
  useEffect(() => {
    // المسار بلا معرّفات (/course/abc → /course/:id)
    reportError(error, path.replace(/\/[^/]*[0-9][^/]*/g, '/:id'));
  }, [error, path]);
  return (
    <View style={{ flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center', padding: spacing.xl, gap: spacing.md }}>
      <Ionicons name="construct-outline" size={48} color={colors.primary} />
      <AppText variant="h2" style={{ textAlign: 'center' }}>
        صار خطأ غير متوقع
      </AppText>
      <AppText muted style={{ textAlign: 'center' }}>
        بياناتك محفوظة. جرّب مرة ثانية، وإن تكرر راسلنا على {APP_INFO.supportEmail}
      </AppText>
      <Button title="حاول مرة ثانية" icon="refresh" onPress={retry} />
      <Button title="الرئيسية" variant="ghost" onPress={() => router.replace('/')} />
    </View>
  );
}
