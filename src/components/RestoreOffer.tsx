import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { View } from 'react-native';
import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { backupLabel, useBackupInfo } from '@/lib/useBackupInfo';
import { useStore } from '@/store/useStore';
import { spacing, useTheme } from '@/theme';

/** جوال جديد بلا بيانات وحسابك عنده نسخة سحابية: نقترح الاستعادة. */
export function RestoreOffer() {
  const { colors } = useTheme();
  const eligible = useStore((s) => !!s.account && !s.settings.restorePromptDismissed && s.courses.length + s.tasks.length + s.students.length === 0);
  const update = useStore((s) => s.updateSettings);
  const info = useBackupInfo(eligible);
  if (!eligible || !info) return null;
  return (
    <Card style={{ gap: spacing.sm, borderWidth: 1.5, borderColor: colors.primary }}>
      <View style={{ flexDirection: 'row', gap: spacing.sm, alignItems: 'center' }}>
        <Ionicons name="cloud-download" size={22} color={colors.primary} />
        <AppText variant="h3" style={{ flex: 1 }}>
          لقينا نسخة لحسابك
        </AppText>
      </View>
      <AppText variant="caption" muted>
        {backupLabel(info)}. استعدها بكلمة مرور النسخة ليرجع كل شيء كما كان.
      </AppText>
      <View style={{ flexDirection: 'row', gap: spacing.sm }}>
        <Button title="استعادة" size="sm" icon="cloud-download-outline" onPress={() => router.push('/backup')} />
        <Button title="لا، شكراً" size="sm" variant="ghost" onPress={() => update({ restorePromptDismissed: true })} />
      </View>
    </Card>
  );
}
