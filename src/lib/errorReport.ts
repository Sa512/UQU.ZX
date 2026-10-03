/**
 * بلاغات الأعطال المجهولة: نص الخطأ فقط، بعد حذف ما قد يدل على شخص (إيميل، أرقام، رموز، روابط).
 * لا يُرسل الاسم ولا الحساب ولا البيانات؛ والخادم لا يحفظ معرّف المستخدم مع البلاغ.
 */
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { cloud } from './cloud';
import { useStore } from '@/store/useStore';
import { createReporter } from './errorScrub';

export { scrubError } from './errorScrub';

const version = Constants.expoConfig?.version ?? '0.0.0';
const platform = (Platform.OS === 'ios' || Platform.OS === 'android' ? Platform.OS : 'web') as 'ios' | 'android' | 'web';

export const reportError = createReporter(async (screen, message) => {
  const s = useStore.getState();
  // يحتاج حساباً (الخادم يحد البلاغات لكل حساب)، والمستخدم لم يوقفها
  if (!cloud.real || !s.account || !s.settings.crashReports) return;
  await cloud.reportError(version, platform, screen, message);
});
