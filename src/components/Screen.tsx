import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, View, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { spacing, useTheme } from '@/theme';
import { AppText } from './AppText';

type Props = {
  title?: string;
  subtitle?: string;
  back?: boolean;
  /** زر إغلاق للنوافذ المنبثقة بدل زر الرجوع. */
  close?: boolean;
  right?: ReactNode;
  children: ReactNode;
  scroll?: boolean;
  footer?: ReactNode;
  contentStyle?: ViewStyle;
  /** الشاشات داخل التبويبات لها شريط سفلي، فلا نضيف هامش الأمان السفلي. */
  inTabs?: boolean;
};

export function HeaderButton({ icon, onPress, label }: { icon: keyof typeof Ionicons.glyphMap; onPress: () => void; label: string }) {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={8}
      onPress={onPress}
      style={({ pressed }) => ({
        width: 42,
        height: 42,
        borderRadius: 21,
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: colors.border,
        alignItems: 'center',
        justifyContent: 'center',
        opacity: pressed ? 0.7 : 1,
      })}
    >
      <Ionicons name={icon} size={22} color={colors.text} />
    </Pressable>
  );
}

const goBack = () => (router.canGoBack() ? router.back() : router.replace('/'));

export function Screen({ title, subtitle, back, close, right, children, scroll = true, footer, contentStyle, inTabs }: Props) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const header = (title || back || close || right) && (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.xl, paddingTop: spacing.sm, paddingBottom: spacing.md }}>
      {back && <HeaderButton icon="chevron-forward" onPress={goBack} label="رجوع" />}
      <View style={{ flex: 1 }}>
        {title && (
          <AppText variant={back || close ? 'h2' : 'title'} numberOfLines={1}>
            {title}
          </AppText>
        )}
        {subtitle && (
          <AppText variant="caption" muted numberOfLines={1}>
            {subtitle}
          </AppText>
        )}
      </View>
      {right}
      {close && <HeaderButton icon="close" onPress={goBack} label="إغلاق" />}
    </View>
  );
  const bottomPad = inTabs ? spacing.xl : insets.bottom + spacing.xl;
  const body = scroll ? (
    <ScrollView
      contentContainerStyle={[{ paddingHorizontal: spacing.xl, paddingBottom: footer ? spacing.xl : bottomPad, gap: spacing.lg }, contentStyle]}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      {children}
    </ScrollView>
  ) : (
    <View style={[{ flex: 1, paddingHorizontal: spacing.xl }, contentStyle]}>{children}</View>
  );
  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={{ flex: 1, backgroundColor: colors.bg, paddingTop: insets.top }}
    >
      {header}
      <View style={{ flex: 1 }}>{body}</View>
      {footer && (
        <View
          style={{
            paddingHorizontal: spacing.xl,
            paddingTop: spacing.md,
            paddingBottom: Math.max(insets.bottom, spacing.lg),
            borderTopWidth: 1,
            borderTopColor: colors.border,
            backgroundColor: colors.bg,
          }}
        >
          {footer}
        </View>
      )}
    </KeyboardAvoidingView>
  );
}

export function SectionHeader({ title, action, onAction }: { title: string; action?: string; onAction?: () => void }) {
  const { colors } = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: spacing.sm }}>
      <AppText variant="h3">{title}</AppText>
      {action && (
        <Pressable accessibilityRole="button" hitSlop={10} onPress={onAction}>
          <AppText variant="label" color={colors.primary}>
            {action}
          </AppText>
        </Pressable>
      )}
    </View>
  );
}
