import { Ionicons } from '@expo/vector-icons';
import { View } from 'react-native';
import { useTheme } from '@/theme';
import { AppText } from './AppText';
import { Button } from './Button';

type Props = {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  message?: string;
  action?: { title: string; onPress: () => void };
};

export function EmptyState({ icon, title, message, action }: Props) {
  const { colors } = useTheme();
  return (
    <View style={{ alignItems: 'center', paddingVertical: 36, paddingHorizontal: 24, gap: 10 }}>
      <View
        style={{
          width: 76,
          height: 76,
          borderRadius: 38,
          backgroundColor: colors.primarySoft,
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: 4,
        }}
      >
        <Ionicons name={icon} size={34} color={colors.primary} />
      </View>
      <AppText variant="h3" center>
        {title}
      </AppText>
      {message && (
        <AppText variant="caption" muted center style={{ maxWidth: 280 }}>
          {message}
        </AppText>
      )}
      {action && <Button title={action.title} onPress={action.onPress} size="sm" icon="add" style={{ marginTop: 6 }} />}
    </View>
  );
}
