import { Ionicons } from '@expo/vector-icons';
import { Redirect, Tabs } from 'expo-router';
import { Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useStore } from '@/store/useStore';
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
  const onboarded = useStore((s) => s.settings.onboarded);
  if (!onboarded) return <Redirect href="/onboarding" />;

  const bottom = Math.max(insets.bottom, Platform.OS === 'web' ? 10 : 8);
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: {
          backgroundColor: colors.tabBar,
          borderTopColor: colors.border,
          height: 64 + bottom,
          paddingTop: 6,
          paddingBottom: bottom,
        },
        tabBarLabelStyle: { fontFamily: fonts.medium, fontSize: 11, lineHeight: 16 },
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
