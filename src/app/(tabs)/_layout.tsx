import { Ionicons } from '@expo/vector-icons';
import { Redirect, Tabs } from 'expo-router';
import { Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useStore } from '@/store/useStore';
import { REQUIRE_LOGIN } from '@/lib/config';
import { useLayout } from '@/lib/useLayout';
import { fonts, useTheme } from '@/theme';

type IconName = keyof typeof Ionicons.glyphMap;

const tabs: { name: string; title: string; icon: IconName; active: IconName }[] = [
  { name: 'index', title: 'الرئيسية', icon: 'home-outline', active: 'home' },
  { name: 'schedule', title: 'الجدول', icon: 'calendar-outline', active: 'calendar' },
  { name: 'focus', title: 'ذاكر', icon: 'timer-outline', active: 'timer' },
  { name: 'tasks', title: 'المهام', icon: 'checkbox-outline', active: 'checkbox' },
  { name: 'more', title: 'المزيد', icon: 'grid-outline', active: 'grid' },
];

export default function TabsLayout() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { wide } = useLayout();
  const onboarded = useStore((s) => s.settings.onboarded);
  const signedIn = useStore((s) => !!s.account);
  // الدخول بالإيميل الجامعي إجباري: المستخدم الجديد يبدأ بالترحيب ثم الحساب، ومن حدّث التطبيق يسجّل دخوله مباشرة
  if (!signedIn && REQUIRE_LOGIN) return <Redirect href={onboarded ? '/auth' : '/onboarding'} />;
  if (!onboarded) return <Redirect href={{ pathname: '/onboarding', params: { step: '2' } }} />;

  const bottom = Math.max(insets.bottom, Platform.OS === 'web' ? 10 : 8);
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        // الآيباد: شريط جانبي (على اليمين مع الاتجاه العربي) بدل الشريط السفلي
        tabBarPosition: wide ? 'left' : 'bottom',
        tabBarVariant: wide ? 'material' : 'uikit',
        // العنوان تحت الأيقونة: شريط نحيف بدل عمود عريض
        tabBarLabelPosition: wide ? 'below-icon' : undefined,
        tabBarStyle: wide
          ? { backgroundColor: colors.tabBar, borderColor: colors.border, paddingTop: insets.top + 12, width: 96 }
          : {
              backgroundColor: colors.tabBar,
              borderTopColor: colors.border,
              height: 64 + bottom,
              paddingTop: 6,
              paddingBottom: bottom,
            },
        tabBarLabelStyle: { fontFamily: fonts.medium, fontSize: wide ? 12 : 11, lineHeight: 16 },
        sceneStyle: { backgroundColor: colors.bg },
      }}
    >
      {tabs.map((t) => (
        <Tabs.Screen
          key={t.name}
          name={t.name}
          options={{
            title: t.title,
            tabBarIcon: ({ color, focused, size }) => <Ionicons name={focused ? t.active : t.icon} size={size} color={color} />,
          }}
        />
      ))}
    </Tabs>
  );
}
