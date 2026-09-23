import { Ionicons } from '@expo/vector-icons';
import { router, type Href } from 'expo-router';
import { View } from 'react-native';
import { AppText } from '@/components/AppText';
import { Card } from '@/components/Card';
import { IconBadge } from '@/components/IconBadge';
import { Screen } from '@/components/Screen';
import { formatShortDate } from '@/lib/dates';
import { shareApp } from '@/lib/growth';
import { ROLE_LABEL } from '@/lib/labels';
import { ar, COURSES, DECKS } from '@/lib/plural';
import { isPro, useStore } from '@/store/useStore';
import { spacing, useTheme } from '@/theme';

type Item = { icon: keyof typeof Ionicons.glyphMap; title: string; subtitle: string; color: string; href: Href };

function Tile({ item }: { item: Item }) {
  return (
    <Card onPress={() => router.push(item.href)} accessibilityLabel={item.title} style={{ flexBasis: '47%', flexGrow: 1, gap: spacing.md }}>
      <IconBadge name={item.icon} color={item.color} />
      <View>
        <AppText variant="h3">{item.title}</AppText>
        <AppText variant="caption" muted numberOfLines={2}>
          {item.subtitle}
        </AppText>
      </View>
    </Card>
  );
}

export default function More() {
  const { colors } = useTheme();
  const settings = useStore((s) => s.settings);
  const sub = useStore((s) => s.subscription);
  const courses = useStore((s) => s.courses.length);
  const decks = useStore((s) => s.decks.length);
  const pro = isPro(sub);
  const isProf = settings.role === 'professor';

  const items: Item[] = [
    { icon: 'library', title: 'المقررات', subtitle: `${ar(courses, COURSES)} مسجلة`, color: '#4F46E5', href: '/courses' },
    { icon: 'albums', title: isProf ? 'بنك الأسئلة' : 'بطاقات المراجعة', subtitle: `${ar(decks, DECKS)} · تكرار متباعد`, color: '#059669', href: '/decks' },
    { icon: 'calculator', title: 'حاسبة المعدل', subtitle: `نظام ${settings.gradeScale} نقاط`, color: '#D97706', href: '/gpa' },
    { icon: 'stats-chart', title: 'الإحصائيات', subtitle: 'تقدمك الأسبوعي', color: '#0284C7', href: '/stats' },
  ];
  if (isProf) {
    items.unshift({ icon: 'people', title: 'الشعب والطلاب', subtitle: 'التحضير والغياب والتواصل', color: '#DB2777', href: '/sections' });
    items.push({ icon: 'time', title: 'ساعات مكتبية', subtitle: 'أضف موعداً للطلاب', color: '#0F766E', href: { pathname: '/slot/new', params: { type: 'office' } } });
  }
  items.push({ icon: 'cloud-download', title: 'استيراد الجدول', subtitle: 'من بوابة الجامعة أو Excel', color: '#7C3AED', href: '/schedule-import' });
  items.push({ icon: 'image', title: 'خلفية الجدول', subtitle: 'جدولك كخلفية للجوال', color: '#B45309', href: '/wallpaper' });

  return (
    <Screen inTabs title="المزيد">
      <Card onPress={() => router.push('/settings')} style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }} accessibilityLabel="الملف الشخصي والإعدادات">
        <View style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: colors.fill, alignItems: 'center', justifyContent: 'center' }}>
          <AppText variant="h2" color="#FFFFFF">
            {settings.name.trim()[0] ?? 'م'}
          </AppText>
        </View>
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <AppText variant="h3" numberOfLines={1}>
              {settings.name || 'مستخدم مذاكر'}
            </AppText>
            {pro && <Ionicons name="diamond" size={16} color={colors.warning} accessibilityLabel="مشترك برو" />}
          </View>
          <AppText variant="caption" muted numberOfLines={1}>
            {ROLE_LABEL[settings.role]}
            {settings.university ? ` · ${settings.university}` : ''}
          </AppText>
        </View>
        <Ionicons name="settings-outline" size={22} color={colors.textMuted} />
      </Card>

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md }}>
        {items.map((i) => (
          <Tile key={i.title} item={i} />
        ))}
      </View>

      <Card onPress={() => shareApp()} accessibilityLabel="شارك مذاكر مع زملائك" style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
        <IconBadge name="share-social" color="#DB2777" />
        <View style={{ flex: 1 }}>
          <AppText variant="h3">شارك مذاكر مع زملائك</AppText>
          <AppText variant="caption" muted>
            أرسل التطبيق لقروب الدفعة أو لصديقك
          </AppText>
        </View>
        <Ionicons name="chevron-back" size={20} color={colors.textMuted} />
      </Card>

      <Card onPress={() => router.push('/pro')} style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, backgroundColor: pro ? colors.successSoft : colors.primarySoft, borderColor: 'transparent' }}>
        <IconBadge name="diamond" color={pro ? colors.success : colors.primary} bg={colors.surface} />
        <View style={{ flex: 1 }}>
          <AppText variant="h3">{pro ? 'اشتراكك في برو فعّال' : 'اشترك في مذاكر برو'}</AppText>
          <AppText variant="caption" muted>
            {pro && sub.until ? `ينتهي في ${formatShortDate(new Date(sub.until))}` : 'ابتداءً من 8.33 ر.س شهرياً'}
          </AppText>
        </View>
        <Ionicons name="chevron-back" size={20} color={colors.textMuted} />
      </Card>
    </Screen>
  );
}
