import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { View } from 'react-native';
import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Field } from '@/components/Field';
import { haptic } from '@/components/haptics';
import { QrScanner, scannerSupported } from '@/components/QrScanner';
import { Screen, SectionHeader } from '@/components/Screen';
import { cloud, type SectionChannel } from '@/lib/cloud';
import { DAY_NAMES, formatMinutes, formatShortDate, fromDateKey } from '@/lib/dates';
import { parseQr } from '@/lib/officeHours';
import { useStore } from '@/store/useStore';
import { radius, spacing } from '@/theme';

const TYPE_AR = { exam: 'اختبار', quiz: 'اختبار قصير', assignment: 'واجب', project: 'مشروع' } as const;

/** انضمام الطالب لشعبة برمز الدكتور: معاينة ثم إضافة المادة بمحاضراتها واختباراتها. */
export default function Join() {
  const params = useLocalSearchParams<{ c?: string }>();
  const applyChannel = useStore((s) => s.applyChannel);
  // نختار المصفوفة نفسها ثم نشتق منها (اختيار مصفوفة جديدة كل مرة يسبب إعادة رسم لا تنتهي)
  const courses = useStore((s) => s.courses);
  const [typed, setTyped] = useState(params.c ?? '');
  const [busy, setBusy] = useState(false);
  const [ch, setCh] = useState<SectionChannel | null>(null);
  const [err, setErr] = useState<string>();

  const lookup = useCallback(async (raw: string) => {
    const q = parseQr(raw);
    const code = q.kind === 'join' || q.kind === 'unknown' ? q.code : '';
    if (!/^[A-Z0-9]{6}$/.test(code)) return setErr('اكتب رمز الشعبة المكوّن من 6 خانات.');
    setBusy(true);
    setErr(undefined);
    try {
      const r = await cloud.getSection(code);
      if (!r) setErr('رمز الشعبة غير صحيح. تأكد منه مع الدكتور.');
      setCh(r);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    // فتح التطبيق من رابط «انضم» يعرض المعاينة مباشرة
    if (params.c) Promise.resolve().then(() => lookup(params.c!));
  }, [params.c, lookup]);

  const join = () => {
    if (!ch) return;
    const r = applyChannel(ch);
    haptic.success();
    router.replace({ pathname: '/course/[id]', params: { id: r.courseId } });
  };

  const already = ch ? courses.some((c) => c.channel?.code === ch.code) : false;

  return (
    <Screen back title="انضم لشعبة" subtitle="برمز الدكتور: تُضاف المادة ومواعيدها واختباراتها">
      {!ch ? (
        <>
          {scannerSupported && <QrScanner onScan={(d) => !busy && lookup(d)} height={260} />}
          <Card style={{ gap: spacing.md }}>
            <Field label="رمز الشعبة" placeholder="مثال: K7M2QX" value={typed} onChangeText={(t) => setTyped(t.toUpperCase())} autoCapitalize="characters" maxLength={40} ltr error={err} />
            <Button title="عرض الشعبة" icon="search" loading={busy} disabled={typed.trim().length < 6} onPress={() => lookup(typed)} />
          </Card>
          <AppText variant="caption" muted center>
            الرمز يعطيك إياه الدكتور من صفحة «قناة الشعبة» في تطبيقه.
          </AppText>
        </>
      ) : (
        <>
          <View style={{ backgroundColor: ch.color, borderRadius: radius.xl, padding: spacing.xl, gap: 4 }}>
            <AppText variant="title" color="#FFFFFF">
              {ch.course_name}
            </AppText>
            <AppText variant="label" color="rgba(255,255,255,0.9)">
              {[ch.course_code, ch.section_code && `شعبة ${ch.section_code}`, ch.instructor].filter(Boolean).join(' · ')}
            </AppText>
          </View>

          <SectionHeader title="المحاضرات" />
          <Card style={{ gap: spacing.sm }}>
            {ch.slots.length === 0 ? (
              <AppText variant="caption" muted>
                لم يُضف الدكتور مواعيد بعد.
              </AppText>
            ) : (
              ch.slots.map((s, i) => (
                <AppText key={i} variant="body">
                  {DAY_NAMES[s.weekday]} · {formatMinutes(s.start_min)}–{formatMinutes(s.end_min)} {s.type === 'lab' ? '· معمل' : ''} {s.location ? `· ${s.location}` : ''}
                </AppText>
              ))
            )}
          </Card>

          <SectionHeader title="الاختبارات والتسليمات" />
          <Card style={{ gap: spacing.sm }}>
            {ch.exams.length === 0 ? (
              <AppText variant="caption" muted>
                لا توجد مواعيد اختبارات بعد، وستصلك عند إضافتها.
              </AppText>
            ) : (
              ch.exams.map((e, i) => (
                <AppText key={i} variant="body">
                  {e.title} · {TYPE_AR[e.type]} · {formatShortDate(fromDateKey(e.date))}
                </AppText>
              ))
            )}
          </Card>

          <Button title={already ? 'أنت منضم: حدّث المواعيد' : 'انضم وأضف المادة'} size="lg" icon={already ? 'refresh' : 'add-circle-outline'} onPress={join} />
          <Button title="رمز آخر" variant="ghost" onPress={() => setCh(null)} />
          <AppText variant="tiny" muted center>
            لا يُرسل شيء عنك للدكتور: الانضمام لقراءة المواعيد والإعلانات فقط.
          </AppText>
        </>
      )}
    </Screen>
  );
}
