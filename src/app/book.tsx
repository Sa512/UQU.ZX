import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';
import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { confirm } from '@/components/confirm';
import { Field } from '@/components/Field';
import { haptic } from '@/components/haptics';
import { QrScanner } from '@/components/QrScanner';
import { Pill } from '@/components/Rows';
import { Screen, SectionHeader } from '@/components/Screen';
import { cloud, type PageInfo } from '@/lib/cloud';
import { latinDigits } from '@/lib/csv';
import { DAY_NAMES, formatMinutes, formatShortDate, fromDateKey } from '@/lib/dates';
import { generateSlots, parseQr, riyadhDay, type OfficeSlot } from '@/lib/officeHours';
import { useNow } from '@/lib/useNow';
import { useStore } from '@/store/useStore';
import { radius, spacing, useTheme } from '@/theme';

export default function Book() {
  const { colors } = useTheme();
  const params = useLocalSearchParams<{ c?: string }>();
  const settings = useStore((s) => s.settings);
  const update = useStore((s) => s.updateSettings);
  const myBookings = useStore((s) => s.myBookings);
  const saveMyBooking = useStore((s) => s.saveMyBooking);
  const setBookingStatus = useStore((s) => s.setBookingStatus);
  const [code, setCode] = useState((params.c ?? '').toUpperCase());
  const [page, setPage] = useState<PageInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [slot, setSlot] = useState<OfficeSlot | null>(null);
  const [name, setName] = useState(settings.name);
  const [uniId, setUniId] = useState(settings.uniId);
  const [topic, setTopic] = useState('');
  const [msg, setMsg] = useState<{ ok: boolean; text: string }>();
  const [scan, setScan] = useState(false);
  const now = useNow();

  const load = useCallback(async (c: string) => {
    const q = parseQr(c);
    const clean = (q.code || c).trim().toUpperCase();
    if (!/^[A-Z0-9]{6}$/.test(clean)) return setMsg({ ok: false, text: 'الرمز من 6 خانات، تجده عند الدكتور.' });
    setLoading(true);
    setMsg(undefined);
    setSlot(null);
    try {
      const p = await cloud.getPage(clean);
      if (!p) setMsg({ ok: false, text: 'الرمز غير صحيح. تأكد منه مع الدكتور.' });
      setPage(p);
      setCode(clean);
    } catch (e) {
      setMsg({ ok: false, text: (e as Error).message });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // يُفتح من رابط الـ QR مباشرة: mudhaker://book?c=…
    if (params.c) Promise.resolve(params.c).then(load);
  }, [params.c, load]);

  const slots = page ? generateSlots(page.windows, page.slot_minutes, page.taken, now, 14) : [];
  const days = [...new Set(slots.map((s) => s.dayKey))];
  const upcoming = myBookings.filter((b) => b.status === 'booked' && new Date(b.startsAt).getTime() > now);

  const book = async () => {
    if (!page || !slot) return;
    const id = latinDigits(uniId.trim());
    if (name.trim().length < 2) return setMsg({ ok: false, text: 'اكتب اسمك' });
    if (id && !/^\d{4,12}$/.test(id)) return setMsg({ ok: false, text: 'الرقم الجامعي أرقام فقط' });
    try {
      const bid = await cloud.book(code, slot.startsAt, name.trim(), id, topic.trim());
      update({ uniId: id || settings.uniId });
      saveMyBooking({ id: bid, code, title: page.title, host: page.host_name, startsAt: slot.startsAt, location: slot.location, status: 'booked' });
      haptic.success();
      setMsg({ ok: true, text: `تم الحجز: ${DAY_NAMES[slot.weekday]} ${formatShortDate(fromDateKey(slot.dayKey))} الساعة ${formatMinutes(slot.minute)} ✓ سنذكّرك قبلها بنصف ساعة.` });
      setSlot(null);
      setTopic('');
      load(code);
    } catch (e) {
      haptic.warn();
      setMsg({ ok: false, text: (e as Error).message });
      load(code);
    }
  };

  return (
    <Screen back title="حجز ساعة مكتبية" subtitle={page ? `${page.host_name} · ${page.title}` : 'أدخل رمز الدكتور أو امسحه'}>
      {upcoming.length > 0 && !page && (
        <>
          <SectionHeader title="حجوزاتي القادمة" />
          {upcoming.map((b) => {
            const d = riyadhDay(new Date(b.startsAt).getTime());
            return (
              <Card key={b.id} style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
                <View style={{ flex: 1 }}>
                  <AppText variant="h3">{b.host}</AppText>
                  <AppText variant="caption" muted>
                    {DAY_NAMES[d.weekday]} {formatShortDate(fromDateKey(d.key))} · {formatMinutes(d.minute)}
                    {b.location ? ` · ${b.location}` : ''}
                  </AppText>
                </View>
                <Button
                  title="إلغاء"
                  size="sm"
                  variant="danger"
                  onPress={() =>
                    confirm('إلغاء الحجز؟', `موعدك مع ${b.host}`, async () => {
                      try {
                        await cloud.cancel(b.id);
                        setBookingStatus(b.id, 'cancelled');
                      } catch (e) {
                        setMsg({ ok: false, text: (e as Error).message });
                      }
                    }, 'إلغاء الحجز')
                  }
                />
              </Card>
            );
          })}
        </>
      )}

      {!page ? (
        <Card style={{ gap: spacing.md }}>
          <AppText variant="h3">رمز الدكتور</AppText>
          <View style={{ flexDirection: 'row', gap: spacing.sm }}>
            <View style={{ flex: 1 }}>
              <Field placeholder="مثال: AB2CD3" value={code} onChangeText={(t) => setCode(t.toUpperCase())} autoCapitalize="characters" maxLength={6} ltr />
            </View>
            <Button title="عرض المواعيد" loading={loading} onPress={() => load(code)} />
          </View>
          {scan ? <QrScanner onScan={(d) => { setScan(false); load(d); }} height={260} /> : <Button title="مسح رمز QR" variant="ghost" icon="qr-code-outline" onPress={() => setScan(true)} />}
        </Card>
      ) : (
        <>
          {!page.is_open && (
            <AppText variant="label" color={colors.warning} center>
              الدكتور أوقف الحجز مؤقتاً.
            </AppText>
          )}
          {days.length === 0 && (
            <Card>
              <AppText variant="caption" muted center>
                لا توجد مواعيد متاحة خلال الأسبوعين القادمين.
              </AppText>
            </Card>
          )}
          {days.map((k) => {
            const daySlots = slots.filter((s) => s.dayKey === k);
            return (
              <View key={k} style={{ gap: 8 }}>
                <AppText variant="label">
                  {DAY_NAMES[daySlots[0].weekday]} {formatShortDate(fromDateKey(k))}
                  {daySlots[0].location ? <AppText variant="caption" muted>{`  · ${daySlots[0].location}`}</AppText> : null}
                </AppText>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                  {daySlots.map((s) => {
                    const on = slot?.startsAt === s.startsAt;
                    return (
                      <Pressable
                        key={s.startsAt}
                        accessibilityRole="button"
                        accessibilityState={{ disabled: s.taken, selected: on }}
                        accessibilityLabel={`${formatMinutes(s.minute)}${s.taken ? ' محجوز' : ''}`}
                        disabled={s.taken || !page.is_open}
                        onPress={() => {
                          haptic.tap();
                          setSlot(s);
                          setMsg(undefined);
                        }}
                        style={{
                          paddingHorizontal: 14,
                          height: 42,
                          borderRadius: radius.md,
                          justifyContent: 'center',
                          borderWidth: 1.5,
                          borderColor: on ? colors.fill : colors.border,
                          backgroundColor: on ? colors.fill : s.taken ? colors.surfaceAlt : colors.surface,
                          opacity: s.taken ? 0.5 : 1,
                        }}
                      >
                        <AppText variant="label" color={on ? '#FFFFFF' : s.taken ? colors.textMuted : colors.text} style={s.taken ? { textDecorationLine: 'line-through' } : undefined}>
                          {formatMinutes(s.minute)}
                        </AppText>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            );
          })}
          {slot && (
            <Card style={{ gap: spacing.md }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <AppText variant="h3" style={{ flex: 1 }}>
                  تأكيد الحجز
                </AppText>
                <Pill label={`${DAY_NAMES[slot.weekday]} ${formatMinutes(slot.minute)}`} tone="info" />
              </View>
              <Field label="الاسم" value={name} onChangeText={setName} />
              <Field label="الرقم الجامعي" value={uniId} onChangeText={setUniId} keyboardType="number-pad" ltr />
              <Field label="موضوع الزيارة (اختياري)" placeholder="مثال: سؤال عن الواجب الثاني" value={topic} onChangeText={setTopic} maxLength={200} />
              <Button title="احجز الموعد" icon="checkmark" onPress={book} />
            </Card>
          )}
          <Button title="رمز آخر" variant="ghost" onPress={() => { setPage(null); setMsg(undefined); }} />
        </>
      )}
      {msg && (
        <AppText variant="label" center color={msg.ok ? colors.success : colors.danger}>
          {msg.text}
        </AppText>
      )}
      {msg?.ok && (
        <Button title="حجوزاتي" variant="secondary" onPress={() => { setPage(null); setMsg(undefined); router.setParams({ c: '' }); }} />
      )}
    </Screen>
  );
}
