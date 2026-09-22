import { Pressable, StyleSheet, View, type StyleProp, type ViewProps, type ViewStyle } from 'react-native';
import { radius, spacing, useTheme } from '@/theme';

type Props = ViewProps & { onPress?: () => void; padded?: boolean; style?: StyleProp<ViewStyle>; accessibilityLabel?: string };

export function Card({ onPress, padded = true, style, children, accessibilityLabel, ...rest }: Props) {
  const { colors, isDark } = useTheme();
  const base: ViewStyle = {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    padding: padded ? spacing.lg : 0,
    ...(isDark
      ? {}
      : {
          shadowColor: '#1E1B4B',
          shadowOpacity: 0.06,
          shadowRadius: 12,
          shadowOffset: { width: 0, height: 4 },
          elevation: 2,
        }),
  };
  if (onPress) {
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        onPress={onPress}
        style={({ pressed }) => [base, pressed && { opacity: 0.85, transform: [{ scale: 0.99 }] }, style]}
        {...rest}
      >
        {children}
      </Pressable>
    );
  }
  return (
    <View style={[base, style]} {...rest}>
      {children}
    </View>
  );
}
