import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Animated, Pressable, View } from 'react-native';
import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { EmptyState } from '@/components/EmptyState';
import { haptic } from '@/components/haptics';
import { Screen } from '@/components/Screen';
import { ar, CARDS } from '@/lib/plural';
import { useStore } from '@/store/useStore';
import { radius, spacing, useTheme } from '@/theme';

export default function Study() {
  const { colors } = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const deck = useStore((s) => s.decks.find((d) => d.id === id));
  const reviewCard = useStore((s) => s.reviewCard);
  const course = useStore((s) => s.courses.find((c) => c.id === deck?.courseId));

  // نثبّت قائمة الجلسة عند فتح الشاشة: المستحقة أولاً، وإن لم توجد فمراجعة حرة للجميع.
  const [queue] = useState(() => {
    if (!deck) return [];
    const now = Date.now();
    const due = deck.cards.filter((c) => c.due <= now);
    const list = due.length ? due : deck.cards;
    const ids = list.map((c) => c.id);
    for (let i = ids.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [ids[i], ids[j]] = [ids[j], ids[i]];
    }
    return ids;
  });

  const [index, setIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [correct, setCorrect] = useState(0);
  const [anim] = useState(() => new Animated.Value(0));

  useEffect(() => {
    Animated.spring(anim, { toValue: revealed ? 1 : 0, useNativeDriver: true, friction: 8 }).start();
  }, [revealed, anim]);

  if (!deck) {
    return (
      <Screen back title="مراجعة">
        <EmptyState icon="alert-circle-outline" title="المجموعة غير موجودة" />
      </Screen>
    );
  }

  const done = index >= queue.length;
  const card = deck.cards.find((c) => c.id === queue[index]);
  const accent = course?.color ?? colors.fill;

  const answer = (ok: boolean) => {
    if (!card) return;
    if (ok) haptic.success();
    else haptic.warn();
    reviewCard(deck.id, card.id, ok);
    if (ok) setCorrect((n) => n + 1);
    setRevealed(false);
    setIndex((i) => i + 1);
  };

  if (done || !card) {
    const pct = queue.length ? Math.round((correct / queue.length) * 100) : 0;
    return (
      <Screen back title={deck.title}>
        <View style={{ alignItems: 'center', gap: spacing.md, paddingVertical: spacing.xxl }}>
          <View style={{ width: 96, height: 96, borderRadius: 48, backgroundColor: colors.successSoft, alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name="trophy" size={48} color={colors.success} />
          </View>
          <AppText variant="title">أحسنت! 🎉</AppText>
          <AppText muted center>
            راجعت {ar(queue.length, CARDS)} وأجبت على {correct} بشكل صحيح ({pct}%).{'\n'}البطاقات الصعبة ستعود إليك قريباً.
          </AppText>
        </View>
        <Button title="العودة للمجموعة" onPress={() => router.back()} />
      </Screen>
    );
  }

  const frontOpacity = anim.interpolate({ inputRange: [0, 0.5, 1], outputRange: [1, 0, 0] });
  const backOpacity = anim.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0, 0, 1] });
  const rotate = anim.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '180deg'] });
  const rotateBack = anim.interpolate({ inputRange: [0, 1], outputRange: ['180deg', '360deg'] });

  return (
    <Screen
      back
      title={deck.title}
      subtitle={`${index + 1} من ${queue.length}`}
      scroll={false}
      footer={
        revealed ? (
          <View style={{ flexDirection: 'row', gap: spacing.md }}>
            <Button style={{ flex: 1 }} size="lg" variant="danger" icon="refresh" title="لم أعرفها" onPress={() => answer(false)} />
            <Button style={{ flex: 1 }} size="lg" variant="success" icon="checkmark" title="عرفتها" onPress={() => answer(true)} />
          </View>
        ) : (
          <Button size="lg" title="اعرض الجواب" icon="eye-outline" onPress={() => setRevealed(true)} />
        )
      }
    >
      <View style={{ height: 6, borderRadius: 3, backgroundColor: colors.surfaceAlt, overflow: 'hidden', marginBottom: spacing.lg }}>
        <View style={{ width: `${(index / queue.length) * 100}%`, height: '100%', backgroundColor: accent }} />
      </View>
      <Pressable accessibilityRole="button" accessibilityLabel={revealed ? card.back : `${card.front}، اضغط لعرض الجواب`} onPress={() => setRevealed((r) => !r)} style={{ flex: 1, maxHeight: 520, marginBottom: spacing.lg }}>
        {[false, true].map((isBack) => (
          <Animated.View
            key={String(isBack)}
            style={{
              position: 'absolute',
              top: 0,
              bottom: 0,
              left: 0,
              right: 0,
              backfaceVisibility: 'hidden',
              opacity: isBack ? backOpacity : frontOpacity,
              transform: [{ perspective: 1200 }, { rotateY: isBack ? rotateBack : rotate }],
              backgroundColor: isBack ? accent : colors.surface,
              borderRadius: radius.xl,
              borderWidth: isBack ? 0 : 1,
              borderColor: colors.border,
              padding: spacing.xxl,
              alignItems: 'center',
              justifyContent: 'center',
              gap: spacing.md,
            }}
          >
            <AppText variant="tiny" color={isBack ? 'rgba(255,255,255,0.8)' : colors.textMuted}>
              {isBack ? 'الجواب' : 'السؤال'}
            </AppText>
            <AppText variant="h2" center color={isBack ? '#FFFFFF' : colors.text}>
              {isBack ? card.back : card.front}
            </AppText>
            {!isBack && (
              <AppText variant="caption" muted center style={{ position: 'absolute', bottom: spacing.xl }}>
                اضغط على البطاقة لقلبها
              </AppText>
            )}
          </Animated.View>
        ))}
      </Pressable>
    </Screen>
  );
}
