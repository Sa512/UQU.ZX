import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as DocumentPicker from 'expo-document-picker';
import { File, Paths } from 'expo-file-system';
import * as Location from 'expo-location';
import * as MailComposer from 'expo-mail-composer';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Linking, Platform, Pressable, View } from 'react-native';
import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Chip, ChipRow } from '@/components/Chip';
import { Field } from '@/components/Field';
import { haptic } from '@/components/haptics';
import { JobMap, type JobMapHandle } from '@/components/JobMap';
import { Screen, SectionHeader } from '@/components/Screen';
import { DEFAULT_BODY, DEFAULT_SUBJECT, findCompanies, pool, scrapeEmails, type Company, type LatLng } from '@/lib/jobHunt';
import { radius, spacing, useTheme } from '@/theme';

const KEY = 'jobs.v1';
// مكة المكرمة كنقطة بداية حتى يُعرف موقع المستخدم
const START: LatLng = { latitude: 21.4225, longitude: 39.8262 };
const RADII = [1, 3, 5, 10];

type Saved = { cvUri?: string; cvName?: string; subject: string; body: string; sent: string[] };

export default function Jobs() {
  const { colors } = useTheme();
  const map = useRef<JobMapHandle>(null);
  const run = useRef({ cancelled: false });
  const [pin, setPin] = useState<LatLng>(START);
  const [km, setKm] = useState(3);
  const [place, setPlace] = useState('');
  const [companies, setCompanies] = useState<Company[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState<'' | 'locate' | 'search' | 'scan'>('');
  const [saved, setSaved] = useState<Saved>({ subject: DEFAULT_SUBJECT, body: DEFAULT_BODY, sent: [] });

  useEffect(() => {
    AsyncStorage.getItem(KEY)
      .then((s) => s && setSaved((old) => ({ ...old, ...JSON.parse(s) })))
      .catch(() => {});
    locate(true);
    return () => {
      run.current.cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const save = (patch: Partial<Saved>) =>
    setSaved((old) => {
      const next = { ...old, ...patch };
      AsyncStorage.setItem(KEY, JSON.stringify(next)).catch(() => {});
      return next;
    });

  const moveTo = (c: LatLng) => {
    setPin(c);
    map.current?.moveTo(c);
  };

  async function locate(silent = false) {
    setBusy('locate');
    try {
      const perm = await Location.requestForegroundPermissionsAsync();
      if (!perm.granted) {
        if (!silent) Alert.alert('الموقع', 'فعّل إذن الموقع من الإعدادات، أو اضغط على الخريطة لتحديد المكان.');
        return;
      }
      const last = await Location.getLastKnownPositionAsync();
      if (last) moveTo(last.coords);
      const now = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      moveTo(now.coords);
    } catch {
      if (!silent) Alert.alert('الموقع', 'تعذر تحديد موقعك الآن.');
    } finally {
      setBusy('');
    }
  }

  async function searchPlace() {
    if (!place.trim()) return;
    setBusy('locate');
    try {
      const [hit] = await Location.geocodeAsync(place.trim());
      if (hit) moveTo(hit);
      else Alert.alert('البحث', 'لم أجد هذا المكان، جرّب اسم الحي مع المدينة.');
    } catch {
      Alert.alert('البحث', 'تعذر البحث عن المكان.');
    } finally {
      setBusy('');
    }
  }

  async function search() {
    run.current.cancelled = true;
    const token = { cancelled: false };
    run.current = token;
    haptic.tap();
    setBusy('search');
    setCompanies([]);
    setSelected(new Set());
    let list: Company[];
    try {
      list = await findCompanies(pin, km * 1000);
    } catch {
      setBusy('');
      Alert.alert('البحث', 'خادم الخرائط مشغول، حاول بعد لحظات.');
      return;
    }
    if (token.cancelled) return;
    setCompanies(list);
    setSelected(new Set(list.filter((c) => c.emails.length && !saved.sent.includes(c.emails[0])).map((c) => c.id)));
    setBusy('scan');
    // فحص مواقع الشركات بالتوازي، وكل نتيجة تظهر فوراً
    await pool(
      list.filter((c) => c.status === 'pending'),
      8,
      async (c) => {
        const found = await scrapeEmails(c.website!).catch(() => []);
        if (token.cancelled) return;
        setCompanies((cur) => cur.map((x) => (x.id === c.id ? { ...x, emails: [...new Set([...x.emails, ...found])], status: 'done' } : x)));
        if (found.length && !saved.sent.includes(found[0])) setSelected((s) => new Set(s).add(c.id));
      },
      token,
    );
    if (!token.cancelled) {
      setBusy('');
      haptic.success();
    }
  }

  async function pickCv() {
    const res = await DocumentPicker.getDocumentAsync({ type: ['application/pdf', '*/*'], copyToCacheDirectory: true });
    if (res.canceled || !res.assets?.length) return;
    const a = res.assets[0];
    const ext = a.name.split('.').pop() || 'pdf';
    try {
      const dest = new File(Paths.document, `cv.${ext}`);
      if (dest.exists) dest.delete();
      await new File(a.uri).copy(dest);
      save({ cvUri: dest.uri, cvName: a.name });
    } catch {
      save({ cvUri: a.uri, cvName: a.name });
    }
  }

  async function send(targets: Company[]) {
    const to = [...new Set(targets.map((c) => c.emails[0]).filter(Boolean))];
    if (!to.length) return;
    if (!saved.cvUri) {
      Alert.alert('السيرة الذاتية', 'أرفق سيرتك الذاتية أولاً.');
      return;
    }
    const single = to.length === 1;
    if (await MailComposer.isAvailableAsync()) {
      // لعدة شركات: نسخة مخفية (BCC) حتى لا ترى كل شركة عناوين البقية
      const r = await MailComposer.composeAsync({
        recipients: single ? to : [],
        bccRecipients: single ? [] : to,
        subject: saved.subject,
        body: saved.body,
        attachments: [saved.cvUri],
      });
      if (r.status === MailComposer.MailComposerStatus.SENT || r.status === MailComposer.MailComposerStatus.UNDETERMINED) {
        save({ sent: [...new Set([...saved.sent, ...to])] });
        setSelected(new Set());
        haptic.success();
      }
    } else {
      Alert.alert('تطبيق البريد', 'أضف حساب بريد في تطبيق Mail ليُرفق السيرة تلقائياً. سنفتح رسالة بدون مرفق الآن.');
      const q = `?bcc=${to.join(',')}&subject=${encodeURIComponent(saved.subject)}&body=${encodeURIComponent(saved.body)}`;
      Linking.openURL(`mailto:${q}`).catch(() => {});
    }
  }

  const withEmail = companies.filter((c) => c.emails.length);
  const chosen = withEmail.filter((c) => selected.has(c.id));
  const scanned = companies.filter((c) => c.status === 'done').length;
  const toggle = (id: string) =>
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  return (
    <Screen
      title="وظّفني"
      subtitle="حدد مكاناً على الخريطة وأرسل سيرتك للشركات القريبة"
      back
      footer={
        chosen.length > 0 && (
          <Button title={`إرسال السيرة إلى ${chosen.length} شركة`} icon="send" size="lg" full onPress={() => send(chosen)} />
        )
      }
    >
      {Platform.OS === 'ios' && (
        <View style={{ height: 300, borderRadius: radius.lg, overflow: 'hidden', borderWidth: 1, borderColor: colors.border }}>
          <JobMap ref={map} pin={pin} radiusM={km * 1000} companies={companies} color={colors.primary} onPick={setPin} />
        </View>
      )}
      <View style={{ flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-end' }}>
        <View style={{ flex: 1 }}>
          <Field placeholder="ابحث عن حي أو مدينة" value={place} onChangeText={setPlace} onSubmitEditing={searchPlace} returnKeyType="search" />
        </View>
        <Button title="موقعي" icon="locate" variant="secondary" loading={busy === 'locate'} onPress={() => locate()} />
      </View>
      <ChipRow>
        {RADII.map((r) => (
          <Chip key={r} label={`${r} كم`} selected={km === r} onPress={() => setKm(r)} />
        ))}
      </ChipRow>
      <Button
        title={busy === 'search' ? 'جاري البحث في الخريطة…' : busy === 'scan' ? `جاري جمع الإيميلات ${scanned}/${companies.length}` : 'ابحث عن الشركات هنا'}
        icon="search"
        size="lg"
        full
        loading={busy === 'search'}
        disabled={busy === 'search'}
        onPress={search}
      />

      <SectionHeader title="سيرتك والرسالة" />
      <Card style={{ gap: spacing.md }}>
        <Button
          title={saved.cvName ? `السيرة: ${saved.cvName}` : 'أرفق سيرتك الذاتية (PDF)'}
          icon={saved.cvName ? 'document-attach' : 'cloud-upload-outline'}
          variant={saved.cvName ? 'secondary' : 'primary'}
          onPress={pickCv}
        />
        <Field label="العنوان" value={saved.subject} onChangeText={(subject) => save({ subject })} />
        <Field label="نص الرسالة" value={saved.body} onChangeText={(body) => save({ body })} multiline />
      </Card>

      {companies.length > 0 && (
        <>
          <SectionHeader title={`شركات بإيميل (${withEmail.length} من ${companies.length})`} />
          {busy === 'scan' && withEmail.length === 0 && <ActivityIndicator color={colors.primary} />}
          {withEmail.map((c) => {
            const on = selected.has(c.id);
            const done = saved.sent.includes(c.emails[0]);
            return (
              <Card key={c.id} onPress={() => toggle(c.id)} accessibilityLabel={c.name} style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
                <Ionicons name={on ? 'checkmark-circle' : 'ellipse-outline'} size={26} color={on ? colors.primary : colors.textMuted} />
                <View style={{ flex: 1, gap: 2 }}>
                  <AppText variant="h3" numberOfLines={1}>{c.name}</AppText>
                  <AppText variant="caption" muted numberOfLines={1} style={{ writingDirection: 'ltr', textAlign: 'right' }}>
                    {c.emails[0]}
                  </AppText>
                  {done && <AppText variant="tiny" color={colors.success}>أُرسلت سابقاً</AppText>}
                </View>
                <Pressable accessibilityRole="button" accessibilityLabel={`إرسال إلى ${c.name}`} hitSlop={8} onPress={() => send([c])}>
                  <Ionicons name="paper-plane-outline" size={22} color={colors.primary} />
                </Pressable>
              </Card>
            );
          })}
          {busy === '' && withEmail.length === 0 && (
            <AppText muted center>
              ما لقيت إيميلات في هذه المنطقة، كبّر المسافة أو جرّب حياً تجارياً.
            </AppText>
          )}
        </>
      )}
    </Screen>
  );
}
