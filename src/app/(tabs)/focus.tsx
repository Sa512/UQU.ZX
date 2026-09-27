import { Ionicons } from '@expo/vector-icons';
import { useEffect, useRef, useState } from 'react';
import { Pressable, View } from 'react-native';
import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Chip, ChipRow } from '@/components/Chip';
import { haptic } from '@/components/haptics';
import { CoursePicker, Stepper } from '@/components/Pickers';
import { ProgressRing } from '@/components/ProgressRing';
import { Screen, SectionHeader } from '@/components/Screen';
import { formatClock, formatDuration, formatMinutes } from '@/lib/dates';
import { cancelFocusEnd, scheduleFocusEnd } from '@/lib/notifications';
import { maybeAskReview } from '@/lib/growth';
import { minutesOn } from '@/lib/stats';
import { BREAK_MAX, clampFocus, EXTEND_OPTIONS, extendTimer, FOCUS_MAX, FOCUS_MIN, openProgress } from '@/lib/focusTimer';
import { ar, MINUTES } from '@/lib/plural';
import { useNow } from '@/lib/useNow';
import { useStore } from '@/store/useStore';
import { spacing, useTheme } from '@/theme';

type Mode = 'focus' | 'break';
type Status = 'idle' | 'running' | 'paused';

const PRESETS = [25, 45, 60, 90];

export default function Focus() {
  const { colors } = useTheme();
  const settings = useStore((s) => s.settings);
  const update = useStore((s) => s.updateSettings);
  const logSession = useStore((s) => s.logSession);
  const sessions = useStore((s) => s.sessions);
  const courses = useStore((s) => s.courses);

  const [courseId, setCourseId] = useState<string | null>(null);
  const [mode, setMode] = useState<Mode>('focus');
  const [status, setStatus] = useState<Status>('idle');
  const [left, setLeft] = useState(0); // الثواني المتبقية أثناء التشغيل أو الإيقاف المؤقت
  const [rounds, setRounds] = useState(0);
  const [extra, setExtra] = useState(0); // ثوانٍ أضافها الطالب للجلسة الجارية
  const endAt = useRef<number | null>(null);
  const openStart = useRef<number | null>(null); // بداية العدّ في الوقت المفتوح (بعد احتساب ما مضى قبل الإيقاف)
  const focusStartedAt = useRef<number | null>(null); // بداية المقطع المركّز الجاري
  const focusSeconds = useRef(0); // ثوانٍ مركّزة متراكمة لم تُسجَّل بعد
  const now = useNow(60_000);

  const open = mode === 'focus' && settings.focusOpen;
  const base = (mode === 'focus' ? settings.focusMin : settings.breakMin) * 60;
  const total = base + extra;
  // في الوقت المفتوح: left = الثواني المنقضية (عدّ تصاعدي)
  const remaining = open ? (status === 'idle' ? 0 : left) : status === 'idle' ? total : left;
  const progress = open ? openProgress(remaining) : 1 - remaining / total;

  /** يوقف احتساب الوقت المركّز الجاري ويضيفه للرصيد. */
  const pauseFocusClock = () => {
    if (focusStartedAt.current !== null) {
      focusSeconds.current += (Date.now() - focusStartedAt.current) / 1000;
      focusStartedAt.current = null;
    }
  };

  const flushFocus = () => {
    pauseFocusClock();
    const mins = Math.floor(focusSeconds.current / 60);
    if (mins >= 1) logSession(courseId, mins);
    focusSeconds.current = 0;
  };

  const complete = () => {
    endAt.current = null;
    openStart.current = null;
    setExtra(0);
    cancelFocusEnd();
    haptic.success();
    if (mode === 'focus') {
      flushFocus();
      maybeAskReview();
      setRounds((r) => r + 1);
      setMode('break');
    } else {
      setMode('focus');
    }
    setStatus('idle');
  };

  const completeRef = useRef(complete);
  useEffect(() => {
    completeRef.current = complete;
  });

  useEffect(() => {
    if (status !== 'running') return;
    const t = setInterval(() => {
      if (openStart.current !== null) {
        setLeft(Math.round((Date.now() - openStart.current) / 1000));
        return;
      }
      if (endAt.current === null) return;
      const secs = Math.max(0, Math.round((endAt.current - Date.now()) / 1000));
      setLeft(secs);
      if (secs <= 0) completeRef.current();
    }, 250);
    return () => clearInterval(t);
  }, [status]);

  const start = () => {
    if (open) {
      const elapsed = status === 'paused' ? left : 0;
      openStart.current = Date.now() - elapsed * 1000;
      focusStartedAt.current = Date.now();
      setLeft(elapsed);
      setStatus('running');
      return;
    }
    const secs = status === 'paused' ? left : total;
    endAt.current = Date.now() + secs * 1000;
    scheduleFocusEnd(endAt.current, mode).catch(() => {});
    if (mode === 'focus') focusStartedAt.current = Date.now();
    setLeft(secs);
    setStatus('running');
  };
  const pause = () => {
    pauseFocusClock();
    endAt.current = null;
    openStart.current = null;
    cancelFocusEnd();
    setStatus('paused');
  };
  const stop = () => {
    if (mode === 'focus') flushFocus();
    endAt.current = null;
    openStart.current = null;
    setExtra(0);
    cancelFocusEnd();
    setStatus('idle');
    setMode('focus');
  };

  /** يضيف دقائق للجلسة (أو يطرحها) ويعيد جدولة تنبيه النهاية. */
  const extend = (minutes: number) => {
    const next = extendTimer({ status, endAt: endAt.current, left, extra }, minutes, base);
    if (next.extra === extra) return;
    haptic.tap();
    endAt.current = next.endAt;
    setLeft(next.left);
    setExtra(next.extra);
    if (status === 'running' && next.endAt) {
      cancelFocusEnd();
      scheduleFocusEnd(next.endAt, mode).catch(() => {});
    }
  };

  const today = new Date(now);
  const todayMin = minutesOn(sessions, today);
  const course = courses.find((c) => c.id === courseId);
  const accent = mode === 'focus' ? course?.color ?? colors.fill : colors.successFill;
  const todaySessions = sessions
    .filter((s) => new Date(s.at).toDateString() === today.toDateString())
    .slice(-5)
    .reverse();

  return (
    <Screen inTabs title="وقت المذاكرة" subtitle={`اليوم: ${formatDuration(todayMin)} · جولات: ${rounds}`}>
      <Card style={{ alignItems: 'center', gap: spacing.lg, paddingVertical: spacing.xxl }}>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <Chip label="تركيز" icon="flash" selected={mode === 'focus'} color={colors.fill} onPress={() => status === 'idle' && setMode('focus')} />
          <Chip label="استراحة" icon="cafe" selected={mode === 'break'} color={colors.successFill} onPress={() => status === 'idle' && setMode('break')} />
        </View>
        <ProgressRing size={250} stroke={14} progress={progress} color={accent}>
          <AppText style={{ fontSize: 56, lineHeight: 70 }} weight="bold" accessibilityRole="timer" accessibilityLabel={`الوقت المتبقي ${formatClock(remaining)}`}>
            {formatClock(remaining)}
          </AppText>
          <AppText variant="label" muted>
            {mode === 'focus' ? course?.name ?? 'مذاكرة عامة' : 'خذ نفساً عميقاً ☕'}
          </AppText>
          {open && (
            <AppText variant="tiny" muted>
              وقت مفتوح · بلا نهاية
            </AppText>
          )}
          {extra > 0 && !open && (
            <AppText variant="tiny" color={accent}>
              مضاف {ar(Math.round(extra / 60), MINUTES)}
            </AppText>
          )}
        </ProgressRing>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xl }}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="إيقاف وحفظ"
            disabled={status === 'idle'}
            onPress={() => {
              haptic.tap();
              stop();
            }}
            style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: colors.surfaceAlt, alignItems: 'center', justifyContent: 'center', opacity: status === 'idle' ? 0.4 : 1 }}
          >
            <Ionicons name="stop" size={24} color={colors.text} />
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={status === 'running' ? 'إيقاف مؤقت' : 'ابدأ'}
            onPress={() => {
              haptic.tap();
              if (status === 'running') pause();
              else start();
            }}
            style={({ pressed }) => ({ width: 84, height: 84, borderRadius: 42, backgroundColor: accent, alignItems: 'center', justifyContent: 'center', transform: [{ scale: pressed ? 0.95 : 1 }] })}
          >
            <Ionicons name={status === 'running' ? 'pause' : 'play'} size={38} color="#FFFFFF" style={status === 'running' ? undefined : { marginLeft: 4 }} />
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="تخطي"
            onPress={() => {
              haptic.tap();
              complete();
            }}
            style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: colors.surfaceAlt, alignItems: 'center', justifyContent: 'center' }}
          >
            <Ionicons name="play-skip-back" size={22} color={colors.text} />
          </Pressable>
        </View>
        {status !== 'idle' && !open && (
          <View style={{ gap: spacing.sm, alignItems: 'center' }}>
            <AppText variant="caption" muted>
              تحتاج وقتاً أكثر؟
            </AppText>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 8 }}>
              {EXTEND_OPTIONS.map((m) => (
                <Chip key={m} label={`${m} د`} icon="add-circle-outline" onPress={() => extend(m)} />
              ))}
              <Chip label="إنقاص 5 د" icon="remove-circle-outline" onPress={() => extend(-5)} />
            </View>
          </View>
        )}
      </Card>

      {status === 'idle' && (
        <>
          <SectionHeader title={mode === 'focus' ? 'مدة التركيز' : 'مدة الاستراحة'} />
          {mode === 'focus' ? (
            <>
              <ChipRow>
                {PRESETS.map((m) => (
                  <Chip key={m} label={ar(m, MINUTES)} selected={!settings.focusOpen && settings.focusMin === m} onPress={() => update({ focusMin: m, focusOpen: false })} />
                ))}
                <Chip label="وقت مفتوح" icon="infinite" selected={settings.focusOpen} onPress={() => update({ focusOpen: true })} />
              </ChipRow>
              {!settings.focusOpen && (
                <Card style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md }}>
                  <AppText variant="label">مدة مخصصة</AppText>
                  <Stepper value={settings.focusMin} onChange={(m) => update({ focusMin: clampFocus(m) })} min={FOCUS_MIN} max={FOCUS_MAX} step={5} format={(n) => ar(n, MINUTES)} />
                </Card>
              )}
              {settings.focusOpen && (
                <AppText variant="caption" muted>
                  العدّاد يعدّ تصاعدياً وتوقفه متى ما خلصت، والحلقة تكتمل كل 25 دقيقة. يُحفظ وقتك كاملاً.
                </AppText>
              )}
            </>
          ) : (
            <Card style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md }}>
              <AppText variant="label">الاستراحة</AppText>
              <Stepper value={settings.breakMin} onChange={(breakMin) => update({ breakMin })} min={1} max={BREAK_MAX} format={(n) => ar(n, MINUTES)} />
            </Card>
          )}
          {courses.length > 0 && (
            <>
              <SectionHeader title="ماذا تذاكر؟" />
              <CoursePicker value={courseId} onChange={setCourseId} />
            </>
          )}
        </>
      )}

      {todaySessions.length > 0 && (
        <>
          <SectionHeader title="جلسات اليوم" />
          <Card style={{ gap: spacing.md }}>
            {todaySessions.map((s) => {
              const c = courses.find((x) => x.id === s.courseId);
              const d = new Date(s.at);
              return (
                <View key={s.id} style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
                  <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: c?.color ?? colors.primary }} />
                  <AppText variant="label" style={{ flex: 1 }}>
                    {c?.name ?? 'مذاكرة عامة'}
                  </AppText>
                  <AppText variant="caption" muted>
                    {formatMinutes(d.getHours() * 60 + d.getMinutes())}
                  </AppText>
                  <AppText variant="label" color={colors.primary}>
                    {formatDuration(s.minutes)}
                  </AppText>
                </View>
              );
            })}
          </Card>
        </>
      )}
      {status !== 'idle' && <Button title="إنهاء الجلسة وحفظها" variant="ghost" icon="save-outline" onPress={stop} />}
    </Screen>
  );
}
