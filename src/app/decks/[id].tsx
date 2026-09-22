import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useRef, useState } from 'react';
import { Pressable, TextInput, View } from 'react-native';
import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { confirm } from '@/components/confirm';
import { EmptyState } from '@/components/EmptyState';
import { Field } from '@/components/Field';
import { haptic } from '@/components/haptics';
import { HeaderButton, Screen, SectionHeader } from '@/components/Screen';
import { MAX_BOX } from '@/lib/srs';
import { useNow } from '@/lib/useNow';
import { useStore } from '@/store/useStore';
import { spacing, useTheme } from '@/theme';

export default function DeckDetail() {
  const { colors } = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const deck = useStore((s) => s.decks.find((d) => d.id === id));
  const { addCard, deleteCard, deleteDeck } = useStore.getState();
  const [front, setFront] = useState('');
  const [back, setBack] = useState('');
  const [error, setError] = useState<string>();
  const now = useNow();
  const frontRef = useRef<TextInput>(null);

  if (!deck) {
    return (
      <Screen back title="المجموعة">
        <EmptyState icon="alert-circle-outline" title="المجموعة غير موجودة" />
      </Screen>
    );
  }
  const due = deck.cards.filter((c) => c.due <= now).length;

  const add = () => {
    if (!front.trim() || !back.trim()) return setError('اكتب السؤال والجواب');
    addCard(deck.id, front.trim(), back.trim());
    haptic.success();
    setFront('');
    setBack('');
    setError(undefined);
    frontRef.current?.focus();
  };

  return (
    <Screen
      back
      title={deck.title}
      subtitle={`${deck.cards.length} بطاقات · ${due} للمراجعة`}
      right={
        <HeaderButton
          icon="trash-outline"
          label="حذف المجموعة"
          onPress={() =>
            confirm('حذف المجموعة؟', 'ستُحذف جميع بطاقاتها.', () => {
              deleteDeck(deck.id);
              router.back();
            })
          }
        />
      }
    >
      <Button
        title={due ? `راجع ${due} بطاقات الآن` : deck.cards.length ? 'مراجعة حرة لكل البطاقات' : 'أضف بطاقات للبدء'}
        size="lg"
        icon="play"
        disabled={!deck.cards.length}
        onPress={() => router.push({ pathname: '/study/[id]', params: { id: deck.id } })}
      />

      <SectionHeader title="بطاقة جديدة" />
      <Card style={{ gap: spacing.md }}>
        <Field ref={frontRef} label="الوجه (السؤال)" placeholder="ما تعقيد البحث الثنائي؟" value={front} onChangeText={setFront} multiline />
        <Field label="الظهر (الجواب)" placeholder="O(log n)" value={back} onChangeText={setBack} multiline error={error} />
        <Button title="إضافة البطاقة" variant="secondary" icon="add" onPress={add} />
      </Card>

      {deck.cards.length > 0 && <SectionHeader title="البطاقات" />}
      {deck.cards.map((c) => (
        <Card key={c.id} style={{ flexDirection: 'row', gap: spacing.md, alignItems: 'flex-start' }}>
          <View style={{ flex: 1, gap: 4 }}>
            <AppText variant="h3">{c.front}</AppText>
            <AppText variant="caption" muted>
              {c.back}
            </AppText>
            <View style={{ flexDirection: 'row', gap: 3, marginTop: 4 }} accessibilityLabel={`مستوى الإتقان ${c.box} من ${MAX_BOX}`}>
              {Array.from({ length: MAX_BOX }, (_, i) => (
                <View key={i} style={{ width: 18, height: 5, borderRadius: 3, backgroundColor: i < c.box ? colors.success : colors.surfaceAlt }} />
              ))}
            </View>
          </View>
          <Pressable accessibilityRole="button" accessibilityLabel="حذف البطاقة" hitSlop={8} onPress={() => deleteCard(deck.id, c.id)}>
            <Ionicons name="close-circle-outline" size={22} color={colors.textMuted} />
          </Pressable>
        </Card>
      ))}
    </Screen>
  );
}
