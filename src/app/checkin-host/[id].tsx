import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { useWindowDimensions, View } from 'react-native';
import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { confirm } from '@/components/confirm';
import { EmptyState } from '@/components/EmptyState';
import { haptic } from '@/components/haptics';
import { QrCode } from '@/components/QrCode';
import { Screen } from '@/components/Screen';
import { cloud, type CheckIn } from '@/lib/cloud';
import { toDateKey } from '@/lib/dates';
import { checkinLink } from '@/lib/officeHours';
import { ar, STUDENTS } from '@/lib/plural';
import { useStore } from '@/store/useStore';
import { radius, spacing, useTheme } from '@/theme';

const ROTATE_MS = 15_000;
const POLL_MS = 3_000;

export default function CheckinHost() {
  const { colors } = useTheme();
  const { width } = useWindowDimensions();
  const { id } = useLocalSearchParams<{ id: string }>();
  const section = useStore((s) => s.sections.find((x) => x.id === id));
  const course = useStore((s) => s.courses.find((c) => c.id === section?.courseId));
  const allStudents = useStore((s) => s.students);
  const saveAttendance = useStore((s) => s.saveAttendance);
  const addStudents = useStore((s) => s.addStudents);
  const [session, setSession] = useState<{ id: string; code: string } | null>(null);
  const [nonce, setNonce] = useState('');
  const [left, setLeft] = useState(ROTATE_MS / 1000);
  const [list, setList] = useState<CheckIn[]>([]);
  const [error, setError] = useState<string>();
  const [finished, setFinished] = useState<{ present: number; absent: number; unknown: CheckIn[] } | null>(null);
  const rotatedAt = useRef(0);

  const roster = allStudents.filter((x) => x.sectionId === id);
  const label = course && section ? `${course.name} · شعبة ${section.code}` : '';

  useEffect(() => {
    if (!session) return;
    let alive = true;
    const tick = setInterval(async () => {
      if (!alive) return;
      const elapsed = Date.now() - rotatedAt.current;
      setLeft(Math.max(0, Math.ceil((ROTATE_MS - elapsed) / 1000)));
      try {
        if (elapsed >= ROTATE_MS) {
          rotatedAt.current = Date.now();
          const n = await cloud.rotate(session.id);
          if (alive) setNonce(n);
        }
      } catch (e) {
        if (alive) setError((e as Error).message);
      }
    }, 1000);
    const poll = setInterval(async () => {
      try {
        const c = await cloud.checkins(session.id);
        if (alive) {
          setList((prev) => {
            if (c.length > prev.length) haptic.tap();
            return c;
          });
          setError(undefined);
        }
      } catch (e) {
        if (alive) setError((e as Error).message);
      }
    }, POLL_MS);
    return () => {
      alive = false;
      clearInterval(tick);
      clearInterval(poll);
    };
  }, [session]);

  if (!section || !course) {
    return (
      <Screen close title="التحضير بالـ QR">
        <EmptyState icon="alert-circle-outline" title="الشعبة غير موجودة" />
      </Screen>
    );
  }

  const start = async () => {
    setError(undefined);
    try {
      const s = await cloud.startSession(label);
      rotatedAt.current = Date.now();
      setNonce(s.nonce);
      setSession({ id: s.id, code: s.code });
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const finish = async () => {
    if (!session) return;
    let final = list;
    try {
      final = await cloud.checkins(session.id);
      await cloud.closeSession(session.id);
    } catch {
      // نكمل بما وصل حتى الآن
    }
    const byUni = new Map(roster.filter((s) => s.uniId).map((s) => [s.uniId, s.id]));
    const presentIds = new Set(final.map((c) => byUni.get(c.uni_id)).filter(Boolean) as string[]);
    const absent = roster.filter((s) => !presentIds.has(s.id)).map((s) => s.id);
    saveAttendance(section.id, toDateKey(new Date()), absent);
    haptic.success();
    setFinished({ present: presentIds.size, absent: absent.length, unknown: final.filter((c) => !byUni.has(c.uni_id)) });
    setSession(null);
  };

  const qrSize = Math.min(width - 2 * spacing.xl - 40, 320);

  if (finished) {
    return (
      <Screen close title="انتهى التحضير" footer={<Button title="تم" size="lg" onPress={() => router.back()} />}>
        <Card style={{ gap: spacing.sm, backgroundColor: colors.successSoft, borderColor: 'transparent' }}>
          <AppText variant="h3">حُفظ تحضير اليوم ✓</AppText>
          <AppText>حاضر {finished.present} · غائب {finished.absent}</AppText>
          <AppText variant="caption" muted>
            تستطيع تعديله يدوياً من «سجل التحضير» في الشعبة.
          </AppText>
        </Card>
        {finished.unknown.length > 0 && (
          <Card style={{ gap: spacing.sm }}>
            <AppText variant="h3">حضروا وليسوا في قائمة الشعبة ({finished.unknown.length})</AppText>
            {finished.unknown.map((c) => (
              <AppText key={c.id} variant="caption">
                {c.student_name} · {c.uni_id}
              </AppText>
            ))}
            <Button
              title="إضافتهم للشعبة"
              size="sm"
              variant="secondary"
              icon="person-add-outline"
              onPress={() => {
                addStudents(section.id, finished.unknown.map((c) => ({ name: c.student_name, uniId: c.uni_id, email: '', phone: '' })));
                setFinished({ ...finished, unknown: [] });
              }}
            />
          </Card>
        )}
      </Screen>
    );
  }

  return (
    <Screen
      close
      title="التحضير بالـ QR"
      subtitle={label}
      footer={
        session ? (
          <Button title={`إنهاء التحضير (${ar(list.length, STUDENTS)})`} size="lg" icon="stop-circle-outline" onPress={() => confirm('إنهاء التحضير؟', 'سيُسجَّل غياب من لم يحضّر.', finish, 'إنهاء')} />
        ) : (
          <Button title="ابدأ التحضير" size="lg" icon="qr-code-outline" onPress={start} />
        )
      }
    >
      {!session ? (
        <Card style={{ gap: spacing.sm }}>
          <AppText variant="h3">كيف يعمل؟</AppText>
          <AppText variant="caption">1. اعرض الرمز على البروجكتر أو شاشة جوالك.</AppText>
          <AppText variant="caption">2. يمسحه الطلاب من «المزيد ← التحضير بالـ QR» في تطبيقهم.</AppText>
          <AppText variant="caption">3. الرمز يتغيّر كل 15 ثانية، فالصورة المرسلة لطالب غائب لا تعمل. وكل جوال يحضّر مرة واحدة.</AppText>
          <AppText variant="caption">4. عند الإنهاء يُسجَّل الحضور والغياب في الشعبة تلقائياً حسب الرقم الجامعي.</AppText>
          {!cloud.real && (
            <AppText variant="caption" color={colors.info}>
              وضع تجريبي: يعمل على هذا الجهاز فقط حتى يُربط الخادم.
            </AppText>
          )}
        </Card>
      ) : (
        <>
          <View style={{ alignItems: 'center', gap: spacing.md }}>
            <QrCode value={checkinLink(session.code, nonce)} size={qrSize} />
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Ionicons name="refresh" size={16} color={colors.textMuted} />
              <AppText variant="caption" muted>
                يتجدد خلال {left} ث
              </AppText>
            </View>
            <View style={{ backgroundColor: colors.surfaceAlt, borderRadius: radius.md, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm }}>
              <AppText variant="h3" style={{ letterSpacing: 2, writingDirection: 'ltr' }} accessibilityLabel={`الرمز ${session.code} ${nonce}`}>
                {session.code} · {nonce}
              </AppText>
            </View>
          </View>
          <Card style={{ gap: spacing.sm }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <AppText variant="h3">الحاضرون</AppText>
              <AppText variant="h3" color={colors.success} accessibilityLiveRegion="polite">
                {list.length} / {roster.length}
              </AppText>
            </View>
            {!cloud.real && (
              <Button
                title="جرّب: حضّر طالباً (وضع تجريبي)"
                size="sm"
                variant="ghost"
                onPress={async () => {
                  const next = roster.find((s) => s.uniId && !list.some((c) => c.uni_id === s.uniId));
                  if (!next) return;
                  try {
                    await cloud.checkIn(session.code, nonce, next.uniId, next.name);
                    setList(await cloud.checkins(session.id));
                  } catch (e) {
                    setError((e as Error).message);
                  }
                }}
              />
            )}
            {list.length === 0 ? (
              <AppText variant="caption" muted>
                بانتظار أول طالب…
              </AppText>
            ) : (
              [...list].reverse().slice(0, 12).map((c) => (
                <AppText key={c.id} variant="caption">
                  ✓ {c.student_name} · {c.uni_id}
                </AppText>
              ))
            )}
          </Card>
        </>
      )}
      {error && (
        <AppText variant="caption" center color={colors.danger}>
          {error}
        </AppText>
      )}
    </Screen>
  );
}
