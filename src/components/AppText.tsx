import { Text, type TextProps, type TextStyle } from 'react-native';
import { fonts, useTheme } from '@/theme';

type Variant = 'display' | 'title' | 'h2' | 'h3' | 'body' | 'label' | 'caption' | 'tiny';

const variants: Record<Variant, TextStyle> = {
  display: { fontSize: 34, lineHeight: 46, fontFamily: fonts.bold },
  title: { fontSize: 26, lineHeight: 38, fontFamily: fonts.bold },
  h2: { fontSize: 20, lineHeight: 30, fontFamily: fonts.bold },
  h3: { fontSize: 16, lineHeight: 25, fontFamily: fonts.semibold },
  body: { fontSize: 15, lineHeight: 24, fontFamily: fonts.regular },
  label: { fontSize: 14, lineHeight: 21, fontFamily: fonts.medium },
  caption: { fontSize: 13, lineHeight: 20, fontFamily: fonts.regular },
  tiny: { fontSize: 11, lineHeight: 16, fontFamily: fonts.medium },
};

export type AppTextProps = TextProps & {
  variant?: Variant;
  color?: string;
  muted?: boolean;
  weight?: keyof typeof fonts;
  center?: boolean;
};

export function AppText({ variant = 'body', color, muted, weight, center, style, ...rest }: AppTextProps) {
  const { colors } = useTheme();
  return (
    <Text
      {...rest}
      style={[
        variants[variant],
        { color: color ?? (muted ? colors.textMuted : colors.text), textAlign: center ? 'center' : 'auto' },
        weight && { fontFamily: fonts[weight] },
        style,
      ]}
    />
  );
}
