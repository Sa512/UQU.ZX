import {
  IBMPlexSansArabic_400Regular,
  IBMPlexSansArabic_500Medium,
  IBMPlexSansArabic_600SemiBold,
  IBMPlexSansArabic_700Bold,
  useFonts,
} from '@expo-google-fonts/ibm-plex-sans-arabic';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import * as SystemUI from 'expo-system-ui';
import { useEffect } from 'react';
import { I18nManager, Platform } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { initPurchases } from '@/lib/purchases';
import { ConfirmHost } from '@/components/ConfirmHost';
import { useReminderSync } from '@/lib/useReminderSync';
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

export { ErrorBoundary } from 'expo-router';

function Navigator() {
  const { colors, isDark } = useTheme();
  useReminderSync();
  // حالة الاشتراك الحقيقية تأتي من المتجر (عند تفعيل RevenueCat) وتتحدث تلقائياً.
  useEffect(() => initPurchases((status) => useStore.getState().setStoreSubscription(status)), []);
  useEffect(() => {
    SystemUI.setBackgroundColorAsync(colors.bg).catch(() => {});
  }, [colors.bg]);
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
