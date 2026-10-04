import { Ionicons } from '@expo/vector-icons';
import { Linking, Platform, Pressable, View } from 'react-native';
import { AppText } from '@/components/AppText';
import { bannerKey, storeUrl, updateGate } from '@/lib/appConfig';
import { APP_VERSION } from '@/lib/appVersion';
import { useStore } from '@/store/useStore';
import { radius, spacing, useTheme } from '@/theme';

/** شريط أعلى الرئيسية: صيانة الخادم، أو إعلان عام من المشرف، أو نسخة أحدث متاحة. */
export function AppBanner() {
  const { colors } = useTheme();
  const c = useStore((s) => s.remoteConfig);
  const dismissed = useStore((s) => s.settings.dismissedBanner);
  const update = useStore((s) => s.updateSettings);
  if (!c) return null;
  const gate = updateGate(c, APP_VERSION);
  const key = bannerKey(c);
  const item = c.maintenance
    ? { icon: 'construct' as const, text: c.maintenance_message || 'نحدّث الخادم الآن: الحجز والتحضير والقنوات والنسخ متوقفة مؤقتاً، وباقي التطبيق يعمل.', warn: true, close: false }
    : key && key !== dismissed
      ? { icon: 'megaphone' as const, text: c.banner, warn: c.banner_level === 'warning', close: true }
      : gate && !gate.force
        ? { icon: 'arrow-up-circle' as const, text: 'نسخة أحدث من مذاكر متاحة — اضغط للتحديث', warn: false, close: false, link: true }
        : null;
  if (!item) return null;
  const fg = item.warn ? colors.warning : colors.primary;
  const body = (
    <>
      <Ionicons name={item.icon} size={20} color={fg} />
      <AppText variant="label" style={{ flex: 1 }} color={colors.text}>
        {item.text}
      </AppText>
    </>
  );
  const box = { flexDirection: 'row' as const, alignItems: 'center' as const, gap: spacing.sm, padding: spacing.md, borderRadius: radius.lg, backgroundColor: item.warn ? colors.warningSoft : colors.primarySoft };
  // رابط التحديث = زر كامل؛ غير ذلك نص وزر إخفاء منفصل (لا أزرار متداخلة)
  if ('link' in item) {
    return (
      <Pressable accessibilityRole="link" onPress={() => Linking.openURL(storeUrl(c, Platform.OS))} style={box}>
        {body}
      </Pressable>
    );
  }
  return (
    <View accessibilityRole={item.warn ? 'alert' : undefined} style={box}>
      {body}
      {item.close && (
        <Pressable accessibilityRole="button" accessibilityLabel="إخفاء الإعلان" hitSlop={10} onPress={() => update({ dismissedBanner: key })}>
          <Ionicons name="close" size={18} color={colors.textMuted} />
        </Pressable>
      )}
    </View>
  );
}
