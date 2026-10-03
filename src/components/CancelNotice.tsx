import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { View } from 'react-native';
import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { unseenCancellations } from '@/lib/bookingSync';
import { DAY_NAMES, formatMinutes, formatShortDate, fromDateKey } from '@/lib/dates';
import { riyadhDay } from '@/lib/officeHours';
import { useStore } from '@/store/useStore';
import { spacing, useTheme } from '@/theme';

/** تنبيه الطالب: الدكتور ألغى موعدك (مع السبب)، وزر لحجز موعد آخر. */
export function CancelNotice({ now, rebook = true }: { now: number; rebook?: boolean }) {
  const { colors } = useTheme();
  const list = unseenCancellations(useStore((s) => s.myBookings), now);
  const dismiss = useStore((s) => s.dismissBookingNotice);
  return list.map((b) => {
    const d = riyadhDay(new Date(b.startsAt).getTime());
    return (
      <Card key={b.id} accessibilityRole="alert" style={{ gap: spacing.sm, borderWidth: 1.5, borderColor: colors.danger }}>
        <View style={{ flexDirection: 'row', gap: spacing.sm, alignItems: 'center' }}>
          <Ionicons name="close-circle" size={22} color={colors.danger} />
          <AppText variant="h3" style={{ flex: 1 }}>
            {b.host} ألغى موعدك
          </AppText>
        </View>
        <AppText variant="caption" muted>
          {DAY_NAMES[d.weekday]} {formatShortDate(fromDateKey(d.key))} · {formatMinutes(d.minute)}
          {b.cancelNote ? ` — «${b.cancelNote}»` : ''}
        </AppText>
        <View style={{ flexDirection: 'row', gap: spacing.sm }}>
          {rebook && (
            <Button
              title="احجز موعداً آخر"
              size="sm"
              icon="calendar"
              onPress={() => {
                dismiss(b.id);
                router.push({ pathname: '/book', params: { c: b.code } });
              }}
            />
          )}
          <Button title="تم" size="sm" variant="ghost" onPress={() => dismiss(b.id)} />
        </View>
      </Card>
    );
  });
}
