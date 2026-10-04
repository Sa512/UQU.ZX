import {
  IBMPlexSansArabic_400Regular,
  IBMPlexSansArabic_500Medium,
  IBMPlexSansArabic_600SemiBold,
  IBMPlexSansArabic_700Bold,
  useFonts,
} from '@expo-google-fonts/ibm-plex-sans-arabic';
import { router, Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import * as SystemUI from 'expo-system-ui';
import { useEffect } from 'react';
import { I18nManager, Platform } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { initPurchases } from '@/lib/purchases';
import { onAnnouncementTap, onPushReceived } from '@/lib/push';
import { ConfirmHost } from '@/components/ConfirmHost';
import { LockGate } from '@/components/LockGate';
import { useReminderSync } from '@/lib/useReminderSync';
import { syncBookings, useAccountSync } from '@/lib/useAccountSync';
import { useCloudBackup } from '@/lib/useCloudBackup';
import { useWidgetSync } from '@/lib/useWidgetSync';
import { useAppConfigSync } from '@/lib/useAppConfigSync';
import { updateGate } from '@/lib/appConfig';
import { APP_VERSION } from '@/lib/appVersion';
import { ForceUpdate } from '@/components/ForceUpdate';
import { useHydrated, useStore } from '@/store/useStore';
import { AppThemeProvider, useTheme } from '@/theme';

// التطبيق عربي بالكامل: نفرض الاتجاه من اليمين لليسار.
// في البناء الإنتاجي يتكفّل به إعداد expo-localization (forcesRTL)، وهذا احتياط لـ Expo Go.
if (Platform.OS !== 'web' && !I18nManager.isRTL) {
  I18nManager.allowRTL(true);
  I18nManager.forceRTL(true);
}
if (Platform.OS === 'web' && typeof document !== 'undefined') {
  document.documentElement.dir = 'rtl';
  document.documentElement.lang = 'ar';
}

SplashScreen.preventAutoHideAsync().catch(() => {});

export { AppErrorBoundary as ErrorBoundary } from '@/components/AppErrorBoundary';

function Navigator() {
  const { colors, isDark } = useTheme();
  useReminderSync();
  useAccountSync();
  useCloudBackup();
  useWidgetSync();
  useAppConfigSync();
  const remoteConfig = useStore((s) => s.remoteConfig);
  const forced = !!remoteConfig && updateGate(remoteConfig, APP_VERSION)?.force;
  // حالة الاشتراك الحقيقية تأتي من المتجر (عند تفعيل RevenueCat) وتتحدث تلقائياً.
  useEffect(() => initPurchases((status) => useStore.getState().setStoreSubscription(status)), []);
  // الضغط على إشعار إعلان يفتح صفحة المادة
  useEffect(
    () =>
      onAnnouncementTap((code) => {
        const c = useStore.getState().courses.find((x) => x.channel?.code === code);
        if (c) router.push({ pathname: '/course/[id]', params: { id: c.id } });
      }, () => router.push('/office-hours'), () => {
        // يتحدّث الحجز من الخادم ثم تُفتح صفحة الحجوزات
        syncBookings().catch(() => {});
        router.push('/book');
      }),
    [],
  );
  useEffect(() => onPushReceived('booking_cancelled', () => void syncBookings().catch(() => {})), []);
  useEffect(() => {
    SystemUI.setBackgroundColorAsync(colors.bg).catch(() => {});
  }, [colors.bg]);
  // إصدار أقدم من الأدنى المسموح: لا يكمل إلا بالتحديث (التحكم الطارئ من لوحة المشرف)
  if (forced && remoteConfig) {
    return (
      <>
        <StatusBar style={isDark ? 'light' : 'dark'} />
        <ForceUpdate config={remoteConfig} />
      </>
    );
  }
  return (
    <>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg }, animation: 'slide_from_left' }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="onboarding" options={{ animation: 'fade' }} />
        <Stack.Screen name="course/new" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
        <Stack.Screen name="slot/new" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
        <Stack.Screen name="task/new" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
        <Stack.Screen name="pro" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
        <Stack.Screen name="student" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
        <Stack.Screen name="roster-import" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
        <Stack.Screen name="schedule-import" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
        <Stack.Screen name="attendance/[id]" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
        <Stack.Screen name="checkin-host/[id]" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
      </Stack>
      {Platform.OS === 'web' && <ConfirmHost />}
      <LockGate />
    </>
  );
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    IBMPlexSansArabic_400Regular,
    IBMPlexSansArabic_500Medium,
    IBMPlexSansArabic_600SemiBold,
    IBMPlexSansArabic_700Bold,
  });
  const hydrated = useHydrated();
  const ready = (fontsLoaded || !!fontError) && hydrated;

  useEffect(() => {
    if (ready) SplashScreen.hideAsync().catch(() => {});
  }, [ready]);

  if (!ready) return null;

  return (
    <SafeAreaProvider>
      <AppThemeProvider>
        <Navigator />
      </AppThemeProvider>
    </SafeAreaProvider>
  );
}
