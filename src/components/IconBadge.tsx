import { Ionicons } from '@expo/vector-icons';
import { View } from 'react-native';
import { radius } from '@/theme';

type Props = { name: keyof typeof Ionicons.glyphMap; color: string; bg?: string; size?: number };

/** أيقونة داخل مربع مستدير بلون خفيف من نفس اللون. */
export function IconBadge({ name, color, bg, size = 44 }: Props) {
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: radius.md,
        backgroundColor: bg ?? color + '1F',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Ionicons name={name} size={size * 0.5} color={color} />
    </View>
  );
}
