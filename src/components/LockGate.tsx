import { useEffect, useRef, useState } from 'react';
import { AppState, Image, View } from 'react-native';
import { shouldRelock, unlock } from '@/lib/appLock';
import { useStore } from '@/store/useStore';
import { spacing, useTheme } from '@/theme';
import { AppText } from './AppText';
import { Button } from './Button';

const ICON = require('../../assets/icon.png');

/**
 * قفل التطبيق بالبصمة: يغطي الشاشة عند الفتح، وعند الرجوع بعد 30 ثانية في الخلفية،
 * ويُخفي المحتوى في قائمة التطبيقات المفتوحة (حماية بيانات الطلاب عند الدكتور).
 */
export function LockGate() {
  const { colors } = useTheme();
  const enabled = useStore((s) => s.settings.appLock);
  const [locked, setLocked] = useState(enabled);
  const [hidden, setHidden] = useState(false);
  const [busy, setBusy] = useState(false);
  const bgAt = useRef<number | null>(null);

  const tryUnlock = async () => {
    setBusy(true);
    const ok = await unlock();
    setBusy(false);
    if (ok) setLocked(false);
  };

  useEffect(() => {
    // أول فتح: نطلب البصمة مباشرة (خارج دورة الرسم)
    if (enabled && locked) Promise.resolve().then(tryUnlock);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (st) => {
      if (st === 'background' || st === 'inactive') {
        if (bgAt.current === null) bgAt.current = Date.now();
        setHidden(enabled);
      } else if (st === 'active') {
        setHidden(false);
        if (shouldRelock(bgAt.current, Date.now(), enabled)) {
          setLocked(true);
          Promise.resolve().then(tryUnlock);
        }
        bgAt.current = null;
      }
    });
    return () => sub.remove();
  }, [enabled]);

  if (!enabled || (!locked && !hidden)) return null;
  return (
    <View style={{ position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center', gap: spacing.lg, padding: spacing.xl }}>
      <Image source={ICON} style={{ width: 88, height: 88, borderRadius: 22 }} accessibilityIgnoresInvertColors />
      <AppText variant="h2">مذاكر مقفل</AppText>
      {locked && (
        <>
          <AppText variant="caption" muted center>
            افتحه ببصمة الوجه أو الإصبع
          </AppText>
          <Button title="فتح" icon="finger-print" size="lg" loading={busy} onPress={tryUnlock} />
        </>
      )}
    </View>
  );
}
