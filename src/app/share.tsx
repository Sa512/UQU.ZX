import { useLocalSearchParams } from 'expo-router';
import { useRef, useState } from 'react';
import { PixelRatio, Platform, Pressable, useWindowDimensions, View } from 'react-native';
import { AppText } from '@/components/AppText';
import { useAbsence } from '@/components/AbsenceCard';
import { Button } from '@/components/Button';
import { EmptyState } from '@/components/EmptyState';
import { haptic } from '@/components/haptics';
import { Screen } from '@/components/Screen';
import { ShareCard } from '@/components/ShareCard';
import { captureSupported, shareCardImage } from '@/lib/capture';
import type { GradeScale } from '@/lib/gpa';
import { summarize } from '@/lib/grades';
import { absenceCard, gpaCard, needCard, streakCard, type CardTone, type ShareCardData } from '@/lib/shareCards';
import { streak } from '@/lib/stats';
import { useNow } from '@/lib/useNow';
import { useStore, type Course } from '@/store/useStore';
import { spacing, useTheme } from '@/theme';

type Kind = 'need' | 'absence' | 'gpa' | 'streak';

const TONE_DOTS: [CardTone, string][] = [
  ['violet', '#6D28D9'],
  ['sky', '#1D4ED8'],
  ['emerald', '#047857'],
  ['amber', '#C2410C'],
  ['rose', '#BE185D'],
  ['midnight', '#0F172A'],
];

/** يُستدعى فقط حين يكون المقرر موجوداً (قاعدة الـ hooks). */
function AbsenceData({ course, children }: { course: Course; children: (d: ShareCardData) => React.ReactNode }) {
  return <>{children(absenceCard(course.name, useAbsence(course)))}</>;
}

function Composer({ data }: { data: ShareCardData }) {
  const { colors } = useTheme();
  const { width } = useWindowDimensions();
  const [tone, setTone] = useState<CardTone>(data.tone);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string>();
  const ref = useRef<View>(null);
  const card = { ...data, tone };
  const previewW = Math.min(width - 2 * spacing.xl, 270);
  // نسخة بالدقة الكاملة خلف الشاشة تُلتقط بدل المعاينة
  const fullW = 1080 / PixelRatio.get();

  const share = async () => {
    setBusy(true);
    const r = await shareCardImage(ref);
    setBusy(false);
    if (r.ok) haptic.success();
    else setMsg(r.message);
  };

  return (
    <View style={{ flex: 1 }}>
      {Platform.OS !== 'web' && (
        <View pointerEvents="none" style={{ position: 'absolute', top: 0, left: 0, zIndex: -1 }}>
          <ShareCard ref={ref} data={card} width={fullW} />
        </View>
      )}
      <Screen
        back
        title="شارك النتيجة"
        subtitle="صورة ستوري لسناب وإنستقرام وواتساب"
        footer={<Button title={captureSupported ? 'مشاركة' : 'المشاركة متاحة في تطبيق الجوال'} size="lg" icon="share-social-outline" loading={busy} disabled={!captureSupported} onPress={share} />}
      >
        <View style={{ alignItems: 'center' }}>
          <View style={{ borderRadius: 22, overflow: 'hidden' }}>
            <ShareCard data={card} width={previewW} />
          </View>
        </View>
        <View style={{ flexDirection: 'row', justifyContent: 'center', gap: spacing.md }}>
          {TONE_DOTS.map(([t, c]) => (
            <Pressable
              key={t}
              accessibilityRole="radio"
              accessibilityState={{ selected: t === tone }}
              accessibilityLabel={`لون ${t}`}
              onPress={() => setTone(t)}
              hitSlop={6}
              style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: c, borderWidth: 3, borderColor: t === tone ? colors.text : 'transparent' }}
            />
          ))}
        </View>
        {msg ? (
          <AppText variant="label" center color={colors.danger}>
            {msg}
          </AppText>
        ) : (
          <AppText variant="caption" muted center>
            الصورة بدقة 1080×1920، وفيها شعار مذاكر ورابطه.
          </AppText>
        )}
      </Screen>
    </View>
  );
}

export default function Share() {
  const p = useLocalSearchParams<{ kind: Kind; id?: string; gpa?: string; scale?: string }>();
  const course = useStore((s) => s.courses.find((c) => c.id === p.id));
  const assessments = useStore((s) => s.assessments);
  const sessions = useStore((s) => s.sessions);
  const now = useNow();

  const empty = (
    <Screen back title="شارك النتيجة">
      <EmptyState icon="image-outline" title="لا توجد نتيجة للمشاركة" message="أدخل درجاتك أو بياناتك أولاً." />
    </Screen>
  );

  if (p.kind === 'absence') {
    return course ? <AbsenceData course={course}>{(d) => <Composer data={d} />}</AbsenceData> : empty;
  }
  let data: ShareCardData | null = null;
  if (p.kind === 'need' && course) data = needCard(course.name, summarize(assessments.filter((a) => a.courseId === course.id)));
  if (p.kind === 'gpa' && p.gpa) data = gpaCard(Number(p.gpa), (Number(p.scale) === 4 ? 4 : 5) as GradeScale);
  if (p.kind === 'streak') {
    const n = streak(sessions, new Date(now));
    data = n > 0 ? streakCard(n) : null;
  }
  return data ? <Composer data={data} /> : empty;
}
