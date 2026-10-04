import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';
import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { CancelNotice } from '@/components/CancelNotice';
import { Card } from '@/components/Card';
import { confirm } from '@/components/confirm';
import { Field } from '@/components/Field';
import { haptic } from '@/components/haptics';
import { QrScanner } from '@/components/QrScanner';
import { Pill } from '@/components/Rows';
import { Screen, SectionHeader } from '@/components/Screen';
import { cloud, type OfficeHost, type PageInfo } from '@/lib/cloud';
import { Ionicons } from '@expo/vector-icons';
import { latinDigits } from '@/lib/csv';
import { DAY_NAMES, formatMinutes, formatShortDate, fromDateKey } from '@/lib/dates';
import { generateSlots, parseQr, riyadhDay, type OfficeSlot } from '@/lib/officeHours';
import { useNow } from '@/lib/useNow';
import { useStore } from '@/store/useStore';
import { sameName } from '@/lib/accounts';
import { radius, spacing, useTheme } from '@/theme';
import { SignInNeeded } from '@/components/SignInNeeded';
import { ensureStudentPush } from '@/lib/hostPush';
import { syncBookings } from '@/lib/useAccountSync';

function BookInner() {
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
  const [hosts, setHosts] = useState<OfficeHost[] | null>(null);
  const [query, setQuery] = useState('');
  const [codeOpen, setCodeOpen] = useState(!!params.c);
  const university = useStore((s) => s.account?.university || s.settings.university);
  const accountName = useStore((s) => s.account?.full_name);
  const courses = useStore((s) => s.courses);
  // دكاترة موادك أولاً (بمطابقة اسم المحاضر في مقرراتك)
  const mine = (h: OfficeHost) => courses.find((c) => c.instructor && sameName(c.instructor, h.host_name));
  const sortedHosts = hosts ? [...hosts].sort((a, b) => Number(!!mine(b)) - Number(!!mine(a))) : null;
  const now = useNow();

  // دليل الساعات المكتبية: كل دكتور معتمد في جامعتك فتح الحجز يظهر هنا (دون رمز)
  useEffect(() => {
    let alive = true;
    const t = setTimeout(() => {
      cloud
        .listOfficeHosts(query)
        .then((h) => alive && setHosts(h))
        .catch(() => alive && setHosts([]));
    }, query ? 300 : 0);
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [query]);

  const load = useCallback(async (c: string, verifiedName?: string) => {
    const q = parseQr(c);
    const clean = (q.code || c).trim().toUpperCase();
    if (!/^[A-Z0-9]{6}$/.test(clean)) return setMsg({ ok: false, text: 'الرمز من 6 خانات، تجده عند الدكتور.' });
    setLoading(true);
    setMsg(undefined);
    setSlot(null);
    try {
      const p = await cloud.getPage(clean);
      if (!p) setMsg({ ok: false, text: 'الرمز غير صحيح. تأكد منه مع الدكتور.' });
      // من الدليل: الاسم المعتمد في حساب الدكتور، لا ما كُتب في الصفحة
      setPage(p && verifiedName ? { ...p, host_name: verifiedName } : p);
      setCode(clean);
    } catch (e) {
      setMsg({ ok: false, text: (e as Error).message });
    } finally {
      setLoading(false);
    }
  }, []);

  // هل ألغى الدكتور أحد مواعيدك؟ (يتحدّث عند فتح الصفحة)
  useEffect(() => {
    syncBookings().catch(() => {});
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
    if (!accountName && name.trim().length < 2) return setMsg({ ok: false, text: 'اكتب اسمك' });
    if (id && !/^\d{4,12}$/.test(id)) return setMsg({ ok: false, text: 'الرقم الجامعي أرقام فقط' });
    try {
      const bid = await cloud.book(code, slot.startsAt, accountName ?? name.trim(), id, topic.trim());
      update({ uniId: id || settings.uniId });
      saveMyBooking({ id: bid, code, title: page.title, host: page.host_name, startsAt: slot.startsAt, location: slot.location, status: 'booked' });
      haptic.success();
      setTopic('');
      // ليصلك إشعار إن ألغى الدكتور الموعد
      ensureStudentPush();
      // التحديث يمسح الرسالة، فنعرض نتيجة الحجز بعده
      await load(code, page.host_name);
      setMsg({ ok: true, text: `تم الحجز: ${DAY_NAMES[slot.weekday]} ${formatShortDate(fromDateKey(slot.dayKey))} الساعة ${formatMinutes(slot.minute)} ✓ سنذكّرك قبلها بنصف ساعة.` });
    } catch (e) {
      haptic.warn();
      await load(code, page.host_name);
      setMsg({ ok: false, text: (e as Error).message });
    }
  };

  return (
    <Screen back title="حجز ساعة مكتبية" subtitle={page ? `${page.host_name} · ${page.title}` : 'اختر الدكتور وشوف مواعيده'}>
      {!page && <CancelNotice now={now} rebook={false} />}
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

      {!page && (
        <>
          <SectionHeader title={university ? `دكاترة ${university}` : 'الدكاترة'} />
          <Field placeholder="ابحث باسم الدكتور أو المادة…" value={query} onChangeText={setQuery} returnKeyType="search" />
          {sortedHosts === null ? (
            <AppText variant="caption" muted center>
              جاري التحميل…
            </AppText>
          ) : sortedHosts.length === 0 ? (
            <Card>
              <AppText variant="caption" muted center>
                {query ? 'لا نتائج. جرّب جزءاً من الاسم.' : 'لم يفتح أي دكتور في جامعتك الحجز بعد. تظهر ساعاتهم هنا تلقائياً أول ما يفتحونها.'}
              </AppText>
            </Card>
          ) : (
            sortedHosts.map((h) => {
              const course = mine(h);
              return (
              <Card key={h.code} onPress={() => load(h.code, h.host_name)} accessibilityLabel={`${h.host_name}، ${h.title}`} style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
                <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' }}>
                  <Ionicons name="person" size={22} color={colors.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <AppText variant="h3">{h.host_name}</AppText>
                  <AppText variant="caption" muted numberOfLines={1}>
                    {h.title} · مواعيد {h.slot_minutes} دقيقة
                  </AppText>
                  {course && (
                    <AppText variant="tiny" color={course.color}>
                      ● دكتور مادتك: {course.name}
                    </AppText>
                  )}
                </View>
                <Ionicons name="chevron-back" size={20} color={colors.textMuted} />
              </Card>
              );
            })
          )}
          {!codeOpen && <Button title="عندي رمز من الدكتور" variant="ghost" size="sm" icon="keypad-outline" onPress={() => setCodeOpen(true)} />}
        </>
      )}

      {!page ? (
        codeOpen && (
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
        )
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
              {accountName ? (
                <AppText variant="caption" muted>
                  الحجز باسم حسابك: <AppText variant="label">{accountName}</AppText>
                </AppText>
              ) : (
                <Field label="الاسم" value={name} onChangeText={setName} />
              )}
              <Field label="الرقم الجامعي" value={uniId} onChangeText={setUniId} keyboardType="number-pad" ltr />
              <Field label="موضوع الزيارة (اختياري)" placeholder="مثال: سؤال عن الواجب الثاني" value={topic} onChangeText={setTopic} maxLength={200} />
              <Button title="احجز الموعد" icon="checkmark" onPress={book} />
            </Card>
          )}
          <Button title="دكتور آخر" variant="ghost" onPress={() => { setPage(null); setMsg(undefined); }} />
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

/** يحتاج حساباً (في وضع الاستخدام بلا حساب يظهر طلب تسجيل الدخول). */
export default function Book() {
  return (
    <SignInNeeded title="حجز ساعة مكتبية" feature="booking">
      <BookInner />
    </SignInNeeded>
  );
}
