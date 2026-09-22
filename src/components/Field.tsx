import { forwardRef } from 'react';
import { TextInput, View, type TextInputProps } from 'react-native';
import { fonts, radius, useTheme } from '@/theme';
import { AppText } from './AppText';

type Props = TextInputProps & { label?: string; error?: string; hint?: string; ltr?: boolean };

export const Field = forwardRef<TextInput, Props>(function Field({ label, error, hint, ltr, style, multiline, ...rest }, ref) {
  const { colors } = useTheme();
  return (
    <View style={{ gap: 6 }}>
      {label && <AppText variant="label">{label}</AppText>}
      <TextInput
        ref={ref}
        placeholderTextColor={colors.textMuted}
        multiline={multiline}
        accessibilityLabel={label}
        style={[
          {
            minHeight: multiline ? 96 : 50,
            borderRadius: radius.md,
            borderWidth: 1.5,
            borderColor: error ? colors.danger : colors.border,
            backgroundColor: colors.surface,
            paddingHorizontal: 14,
            paddingVertical: multiline ? 12 : 0,
            color: colors.text,
            fontFamily: fonts.regular,
            fontSize: 16,
            textAlign: ltr ? 'left' : undefined,
            writingDirection: ltr ? 'ltr' : undefined,
            textAlignVertical: multiline ? 'top' : 'center',
          },
          style,
        ]}
        {...rest}
      />
      {error ? (
        <AppText variant="caption" color={colors.danger}>
          {error}
        </AppText>
      ) : hint ? (
        <AppText variant="caption" muted>
          {hint}
        </AppText>
      ) : null}
    </View>
  );
});
