import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';
import { useStore } from '@/store/useStore';

const enabled = () => Platform.OS !== 'web' && useStore.getState().settings.haptics;

export const haptic = {
  tap: () => enabled() && Haptics.selectionAsync().catch(() => {}),
  success: () => enabled() && Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {}),
  warn: () => enabled() && Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {}),
};
