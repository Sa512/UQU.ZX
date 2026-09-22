import { useLocalSearchParams } from 'expo-router';
import { Linking, Pressable, View } from 'react-native';
import { AppText } from '@/components/AppText';
import { Card } from '@/components/Card';
import { Screen } from '@/components/Screen';
import { APP_INFO } from '@/content/app';
import { legalDocs, type LegalKind } from '@/content/legal';
import { spacing, useTheme } from '@/theme';

export default function Legal() {
  const { colors } = useTheme();
  const { doc } = useLocalSearchParams<{ doc?: string }>();
  const kind: LegalKind = doc === 'terms' ? 'terms' : 'privacy';
  const d = legalDocs(APP_INFO)[kind];
  return (
    <Screen back title={d.title}>
      <AppText muted>{d.intro}</AppText>
      {d.sections.map((s) => (
        <Card key={s.heading} style={{ gap: spacing.sm }}>
          <AppText variant="h3">{s.heading}</AppText>
          {s.paragraphs.map((p) => (
            <AppText key={p} variant="body">
              {p}
            </AppText>
          ))}
        </Card>
      ))}
      <View style={{ flexDirection: 'row', justifyContent: 'center', gap: spacing.lg }}>
        <Pressable accessibilityRole="link" onPress={() => Linking.openURL(`mailto:${APP_INFO.supportEmail}`)}>
          <AppText variant="label" color={colors.primary}>
            راسلنا
          </AppText>
        </Pressable>
        <Pressable accessibilityRole="link" onPress={() => Linking.openURL(`tel:${APP_INFO.supportPhoneIntl}`)}>
          <AppText variant="label" color={colors.primary}>
            اتصل بنا
          </AppText>
        </Pressable>
      </View>
    </Screen>
  );
}
