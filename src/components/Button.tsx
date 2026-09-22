import { Ionicons } from '@expo/vector-icons';
import { ActivityIndicator, Pressable, View, type StyleProp, type ViewStyle } from 'react-native';
import { radius, useTheme } from '@/theme';
import { AppText } from './AppText';
import { haptic } from './haptics';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'success';

type Props = {
  title: string;
  onPress?: () => void;
  variant?: Variant;
  icon?: keyof typeof Ionicons.glyphMap;
  loading?: boolean;
  disabled?: boolean;
  size?: 'md' | 'lg' | 'sm';
  style?: StyleProp<ViewStyle>;
  full?: boolean;
};

export function Button({ title, onPress, variant = 'primary', icon, loading, disabled, size = 'md', style, full }: Props) {
  const { colors } = useTheme();
  const palette: Record<Variant, { bg: string; fg: string; border?: string }> = {
    primary: { bg: colors.fill, fg: colors.textOnPrimary },
    secondary: { bg: colors.primarySoft, fg: colors.primary },
    ghost: { bg: 'transparent', fg: colors.primary, border: colors.border },
    danger: { bg: colors.dangerSoft, fg: colors.danger },
    success: { bg: colors.successFill, fg: '#FFFFFF' },
  };
  const p = palette[variant];
  const h = size === 'lg' ? 56 : size === 'sm' ? 38 : 48;
  const inactive = disabled || loading;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityState={{ disabled: !!inactive, busy: !!loading }}
      disabled={inactive}
      onPress={() => {
        haptic.tap();
        onPress?.();
      }}
      style={({ pressed }) => [
        {
          height: h,
          borderRadius: radius.md,
          backgroundColor: p.bg,
          borderWidth: p.border ? 1 : 0,
          borderColor: p.border,
          paddingHorizontal: size === 'sm' ? 14 : 20,
          alignItems: 'center',
          justifyContent: 'center',
          opacity: disabled ? 0.45 : pressed ? 0.85 : 1,
          alignSelf: full ? 'stretch' : undefined,
          transform: [{ scale: pressed ? 0.98 : 1 }],
        },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={p.fg} />
      ) : (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          {icon && <Ionicons name={icon} size={size === 'sm' ? 16 : 20} color={p.fg} />}
          <AppText variant={size === 'sm' ? 'label' : 'h3'} color={p.fg}>
            {title}
          </AppText>
        </View>
      )}
    </Pressable>
  );
}
