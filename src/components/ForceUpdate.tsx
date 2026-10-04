import { Ionicons } from '@expo/vector-icons';
import { Linking, Platform, View } from 'react-native';
import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { storeUrl } from '@/lib/appConfig';
import { APP_VERSION } from '@/lib/appVersion';
import type { AppConfig } from '@/lib/cloud';
import { APP_INFO } from '@/content/app';
import { spacing, useTheme } from '@/theme';

/** إصدار أقدم من الأدنى المسموح (خلل خطير أو تغيير في الخادم): لا يكمل إلا بالتحديث. بياناته محفوظة. */
export function ForceUpdate({ config }: { config: AppConfig }) {
  const { colors } = useTheme();
  return (
    <View accessibilityRole="alert" style={{ flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center', padding: spacing.xl, gap: spacing.md }}>
      <Ionicons name="arrow-up-circle" size={64} color={colors.primary} />
      <AppText variant="h2" center>
        حدّث مذاكر للمتابعة
      </AppText>
      <AppText muted center>
        هذا الإصدار ({APP_VERSION}) لم يعد مدعوماً. التحديث يأخذ دقيقة، وبياناتك كلها محفوظة على جوالك.
      </AppText>
      <Button title={Platform.OS === 'android' ? 'التحديث من Google Play' : 'التحديث من App Store'} icon="download-outline" size="lg" onPress={() => Linking.openURL(storeUrl(config, Platform.OS))} />
      <AppText variant="caption" muted center>
        تحتاج مساعدة؟ {APP_INFO.supportEmail}
      </AppText>
    </View>
  );
}
