import { Alert, Platform } from 'react-native';

/** نافذة تأكيد موحّدة للجوال والويب. */
export function confirm(title: string, message: string, onYes: () => void, yes = 'حذف') {
  if (Platform.OS === 'web') {
    if (window.confirm(`${title}\n${message}`)) onYes();
    return;
  }
  Alert.alert(title, message, [
    { text: 'إلغاء', style: 'cancel' },
    { text: yes, style: 'destructive', onPress: onYes },
  ]);
}
