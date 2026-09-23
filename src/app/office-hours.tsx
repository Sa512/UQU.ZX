import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Share, View } from 'react-native';
import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Chip, ChipRow } from '@/components/Chip';
import { confirm } from '@/components/confirm';
import { EmptyState } from '@/components/EmptyState';
import { Field } from '@/components/Field';
import { haptic } from '@/components/haptics';
import { QrCode } from '@/components/QrCode';
import { Screen, SectionHeader } from '@/components/Screen';
import { Toggle } from '@/components/Toggle';
import { cloud, type Booking } from '@/lib/cloud';
import { DAY_NAMES, formatMinutes, formatShortDate, fromDateKey } from '@/lib/dates';
import { bookLink, riyadhDay } from '@/lib/officeHours';
import { ar, MINUTES } from '@/lib/plural';
import { useStore } from '@/store/useStore';
import { radius, spacing, useTheme } from '@/theme';

export default function OfficeHours() {
  const { colors } = useTheme();
  const settings = useStore((s) => s.settings);
  const slots = useStore((s) => s.slots);
  const page = useStore((s) => s.officePage);
  const setOfficePage = useStore((s) => s.setOfficePage);
  const office = slots.filter((s) => s.type === 'office').sort((a, b) => a.day - b.day || a.start - b.start);
  const [title, setTitle] = useState(page?.title ?? 'الساعات المكتبية');
  const [minutes, setMinutes] = useState(page?.slotMinutes ?? 15);
  const [busy, setBusy] = useState(false);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [msg, setMsg] = useState<{ ok: boolean; text: string }>();

  const refresh = useCallback(async () => {
    if (!page) return;
    try {
      setBookings(await cloud.pageBookings(page.id));
    } catch (e) {
      setMsg({ ok: false, text: (e as Error).message });
    }
  }, [page]);

  useEffect(() => {
    Promise.resolve().then(refresh);
  }, [refresh]);

  const publish = async () => {
    if (!office.length) return;
    setBusy(true);
    setMsg(undefined);
    try {
      const r = await cloud.publishPage({
        id: page?.id,
        title: title.trim() || 'الساعات المكتبية',
        host_name: settings.name.trim() || 'عضو هيئة التدريس',
        slot_minutes: minutes,
        windows: office.map((s) => ({ weekday: s.day, start_min: s.start, end_min: s.end, location: s.room })),
      });
      setOfficePage({ id: r.id, code: r.code, title: title.trim(), slotMinutes: minutes, open: page?.open ?? true });
      haptic.success();
      setMsg({ ok: true, text: page ? 'حُدّثت المواعيد ✓' : 'نُشرت ساعاتك المكتبية ✓ شارك الرمز مع طلابك.' });
    } catch (e) {
      setMsg({ ok: false, text: (e as Error).message });
    } finally {
      setBusy(false);
    }
  };

  const shareMsg = page
    ? `احجز موعدك في ساعاتي المكتبية عبر تطبيق مذاكر:\nالمزيد ← حجز ساعة مكتبية ← الرمز: ${page.code}\n${bookLink(page.code)}`
    : '';

  return (
    <Screen back title="حجز الساعات المكتبية" subtitle="طلابك يحجزون مواعيدهم بأنفسهم">
      {office.length === 0 ? (
        <Card padded={false}>
          <EmptyState
            icon="time-outline"
            title="أضف ساعاتك المكتبية أولاً"
            message="أضفها في الجدول (نوع: ساعات مكتبية) أو استوردها، ثم انشرها هنا للحجز."
            action={{ title: 'إضافة ساعة مكتبية', onPress: () => router.push({ pathname: '/slot/new', params: { type: 'office' } }) }}
          />
        </Card>
      ) : (
        <>
          {page && (
            <Card style={{ alignItems: 'center', gap: spacing.md }}>
              <QrCode value={bookLink(page.code)} size={180} />
              <View style={{ backgroundColor: colors.surfaceAlt, borderRadius: radius.md, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm }}>
                <AppText variant="title" style={{ letterSpacing: 4, writingDirection: 'ltr' }} accessibilityLabel={`رمز الحجز ${page.code}`}>
                  {page.code}
                </AppText>
              </View>
              <AppText variant="caption" muted center>
                يمسحه الطالب أو يكتبه في «المزيد ← حجز ساعة مكتبية». ضعه في المنهج أو على باب المكتب.
              </AppText>
              <View style={{ flexDirection: 'row', gap: spacing.sm, alignSelf: 'stretch' }}>
                <Button style={{ flex: 1 }} title="مشاركة" icon="share-outline" variant="secondary" onPress={() => Share.share({ message: shareMsg }).catch(() => {})} />
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, alignSelf: 'stretch' }}>
                <AppText variant="label" style={{ flex: 1 }}>
                  استقبال الحجوزات
                </AppText>
                <Toggle
                  accessibilityLabel="استقبال الحجوزات"
                  value={page.open}
                  onValueChange={async (open) => {
                    try {
                      await cloud.setPageOpen(page.id, open);
                      setOfficePage({ ...page, open });
                    } catch (e) {
                      setMsg({ ok: false, text: (e as Error).message });
                    }
                  }}
                />
              </View>
            </Card>
          )}

          {page && (
            <>
              <SectionHeader title={`الحجوزات القادمة (${bookings.length})`} action="تحديث" onAction={refresh} />
              {bookings.length === 0 ? (
                <Card>
                  <AppText variant="caption" muted center>
                    لا حجوزات بعد.
                  </AppText>
                </Card>
              ) : (
                bookings.map((b) => {
                  const d = riyadhDay(new Date(b.starts_at).getTime());
                  return (
                    <Card key={b.id} style={{ gap: 4 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        <AppText variant="h3" style={{ flex: 1 }}>
                          {b.student_name}
                        </AppText>
                        <AppText variant="label" color={colors.primary}>
                          {DAY_NAMES[d.weekday]} {formatShortDate(fromDateKey(d.key))} · {formatMinutes(d.minute)}
                        </AppText>
                      </View>
                      <AppText variant="caption" muted>
                        {[b.uni_id, b.topic].filter(Boolean).join(' · ') || 'بدون موضوع'}
                      </AppText>
                      <Button
                        title="إلغاء الموعد"
                        size="sm"
                        variant="ghost"
                        style={{ alignSelf: 'flex-start' }}
                        onPress={() =>
                          confirm('إلغاء الموعد؟', `موعد ${b.student_name}`, async () => {
                            try {
                              await cloud.cancel(b.id);
                              refresh();
                            } catch (e) {
                              setMsg({ ok: false, text: (e as Error).message });
                            }
                          }, 'إلغاء الموعد')
                        }
                      />
                    </Card>
                  );
                })
              )}
            </>
          )}

          <SectionHeader title={page ? 'الإعدادات' : 'نشر الساعات المكتبية'} />
          <Card style={{ gap: spacing.md }}>
            <AppText variant="caption" muted>
              من جدولك:
            </AppText>
            {office.map((s) => (
              <AppText key={s.id} variant="label">
                {DAY_NAMES[s.day]} · {formatMinutes(s.start)}–{formatMinutes(s.end)}
                {s.room ? ` · ${s.room}` : ''}
              </AppText>
            ))}
            <Field label="العنوان" value={title} onChangeText={setTitle} />
            <AppText variant="label">مدة الموعد</AppText>
            <ChipRow>
              {[10, 15, 20, 30].map((m) => (
                <Chip key={m} label={ar(m, MINUTES)} selected={minutes === m} onPress={() => setMinutes(m)} />
              ))}
            </ChipRow>
            <Button title={page ? 'تحديث المواعيد' : 'نشر للحجز'} icon="cloud-upload-outline" loading={busy} onPress={publish} />
          </Card>
        </>
      )}
      {msg && (
        <AppText variant="label" center color={msg.ok ? colors.success : colors.danger}>
          {msg.text}
        </AppText>
      )}
      {!cloud.real && (
        <AppText variant="tiny" muted center>
          وضع تجريبي: الحجز يعمل على هذا الجهاز فقط حتى يُربط الخادم (انظر LAUNCH.md).
        </AppText>
      )}
    </Screen>
  );
}
