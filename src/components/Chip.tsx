import { Ionicons } from '@expo/vector-icons';
import { Pressable, View } from 'react-native';
import { radius, useTheme } from '@/theme';
import { AppText } from './AppText';
import { haptic } from './haptics';

type Props = {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  color?: string;
  icon?: keyof typeof Ionicons.glyphMap;
};

export function Chip({ label, selected, onPress, color, icon }: Props) {
  const { colors } = useTheme();
  const accent = color ?? colors.fill;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: !!selected }}
      accessibilityLabel={label}
      onPress={() => {
        haptic.tap();
        onPress?.();
      }}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: 14,
        height: 38,
        borderRadius: radius.pill,
        borderWidth: 1.5,
        borderColor: selected ? accent : colors.border,
        backgroundColor: selected ? accent : colors.surface,
        opacity: pressed ? 0.8 : 1,
      })}
    >
      {icon && <Ionicons name={icon} size={16} color={selected ? '#FFFFFF' : colors.textMuted} />}
      <AppText variant="label" color={selected ? '#FFFFFF' : colors.text}>
        {label}
      </AppText>
    </Pressable>
  );
}

export function ChipRow({ children }: { children: React.ReactNode }) {
  return <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>{children}</View>;
}
