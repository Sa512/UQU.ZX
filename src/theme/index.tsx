import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { useColorScheme } from 'react-native';
import { useStore } from '@/store/useStore';
import { resolveDark } from '@/lib/themeMode';
import { useNow } from '@/lib/useNow';
import { dark, light, type Palette } from './colors';

export const fonts = {
  regular: 'IBMPlexSansArabic_400Regular',
  medium: 'IBMPlexSansArabic_500Medium',
  semibold: 'IBMPlexSansArabic_600SemiBold',
  bold: 'IBMPlexSansArabic_700Bold',
} as const;

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 28 } as const;
export const radius = { sm: 10, md: 14, lg: 20, xl: 28, pill: 999 } as const;

export type Theme = { colors: Palette; isDark: boolean };

const ThemeContext = createContext<Theme>({ colors: light, isDark: false });

export function AppThemeProvider({ children }: { children: ReactNode }) {
  const system = useColorScheme();
  const pref = useStore((s) => s.settings.theme);
  // «حسب الوقت» يعيد الحساب كل دقيقة فيتحول التطبيق وحده عند 6 مساءً و6 صباحاً
  const now = useNow(60_000);
  const isDark = resolveDark(pref, system === 'dark', new Date(now));
  const value = useMemo(() => ({ colors: isDark ? dark : light, isDark }), [isDark]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export const useTheme = () => useContext(ThemeContext);

export { courseColors } from './colors';
