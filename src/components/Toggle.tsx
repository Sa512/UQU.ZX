import { Platform, Switch, View } from 'react-native';
import { useTheme } from '@/theme';

type Props = { value: boolean; onValueChange: (v: boolean) => void; accessibilityLabel: string };

/**
 * مفتاح تشغيل موحّد. على الويب يُعرض المفتاح باتجاه LTR داخلياً
 * لأن react-native-web يزيح المقبض عن المسار في الصفحات RTL.
 */
export function Toggle({ value, onValueChange, accessibilityLabel }: Props) {
  const { colors } = useTheme();
  const sw = (
    <Switch
      accessibilityLabel={accessibilityLabel}
      value={value}
      onValueChange={onValueChange}
      trackColor={{ true: colors.primary, false: colors.border }}
      thumbColor="#FFFFFF"
      {...(Platform.OS === 'web' ? ({ activeThumbColor: '#FFFFFF' } as object) : null)}
    />
  );
  return Platform.OS === 'web' ? <View style={{ direction: 'ltr' }}>{sw}</View> : sw;
}
