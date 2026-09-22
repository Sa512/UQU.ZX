import { Alert, Platform } from 'react-native';

export type ConfirmRequest = { title: string; message: string; yes: string; onYes: () => void };

let host: ((r: ConfirmRequest) => void) | null = null;

/** تسجّله نافذة التأكيد المرسومة داخل التطبيق (للويب، حيث قد تُمنع نوافذ المتصفح). */
export function registerConfirmHost(fn: ((r: ConfirmRequest) => void) | null) {
  host = fn;
}

/** نافذة تأكيد موحّدة: نافذة النظام على الجوال، ونافذة داخل التطبيق على الويب. */
export function confirm(title: string, message: string, onYes: () => void, yes = 'حذف') {
  if (Platform.OS === 'web') {
    if (host) host({ title, message, yes, onYes });
    else if (window.confirm(`${title}\n${message}`)) onYes();
    return;
  }
  Alert.alert(title, message, [
    { text: 'إلغاء', style: 'cancel' },
    { text: yes, style: 'destructive', onPress: onYes },
  ]);
}
