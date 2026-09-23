import { View } from 'react-native';
import { radius, spacing, useTheme } from '@/theme';
import { AppText } from './AppText';

/** الويب: لا كاميرا — يُكتب الرمز يدوياً. */
export const scannerSupported = false;

export function QrScanner({ height = 120 }: { onScan: (data: string) => void; height?: number }) {
  const { colors } = useTheme();
  return (
    <View style={{ height, borderRadius: radius.lg, backgroundColor: colors.surfaceAlt, alignItems: 'center', justifyContent: 'center', padding: spacing.lg }}>
      <AppText variant="caption" muted center>
        مسح الرمز بالكاميرا متاح في تطبيق الجوال. اكتب الرمز الظاهر تحت الـ QR بالأسفل.
      </AppText>
    </View>
  );
}
