import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Pressable, Share, TextInput, View } from 'react-native';
import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { confirm } from '@/components/confirm';
import { EmptyState } from '@/components/EmptyState';
import { Field } from '@/components/Field';
import { haptic } from '@/components/haptics';
import { CoursePicker } from '@/components/Pickers';
import { HeaderButton, Screen, SectionHeader } from '@/components/Screen';
import { Segmented } from '@/components/Segmented';
import { ar, CARDS } from '@/lib/plural';
import { block, BLOCK_INFO, BLOCK_ORDER, MAX_BLOCKS, structureText, summaryStats, toText, type Block, type BlockType, type Summary } from '@/lib/summaries';
import { FREE_LIMITS, isPro, useStore } from '@/store/useStore';
import { fonts, radius, spacing, useTheme } from '@/theme';

type Icon = keyof typeof Ionicons.glyphMap;

export default function NoteScreen() {
  const { id, edit, paste } = useLocalSearchParams<{ id: string; edit?: string; paste?: string }>();
  const summary = useStore((s) => s.summaries.find((x) => x.id === id));
  if (!summary) {
    return (
      <Screen back title="الملخص">
        <EmptyState icon="alert-circle-outline" title="الملخص غير موجود" />
      </Screen>
    );
  }
  return <Editor key={summary.id} summary={summary} startEdit={edit === '1'} startPaste={paste === '1'} />;
}

function Editor({ summary, startEdit, startPaste }: { summary: Summary; startEdit: boolean; startPaste: boolean }) {
  const { colors } = useTheme();
  const courses = useStore((s) => s.courses);
  const decksCount = useStore((s) => s.decks.length);
  const pro = useStore((s) => isPro(s.subscription));
  const { updateSummary, deleteSummary, summaryToDeck } = useStore.getState();

  const [mode, setMode] = useState<'view' | 'edit'>(startEdit ? 'edit' : 'view');
  const [title, setTitle] = useState(summary.title);
  const [courseId, setCourseId] = useState(summary.courseId);
  const [blocks, setBlocks] = useState<Block[]>(summary.blocks);
  const [pasteOpen, setPasteOpen] = useState(startPaste);
  const [pasted, setPasted] = useState('');
  const [typing, setTyping] = useState<string | null>(null);
  const [revealed, setRevealed] = useState<Set<string>>(new Set());
  const [quiz, setQuiz] = useState(false);
  const [deckMsg, setDeckMsg] = useState<{ deckId: string; added: number }>();

  // حفظ تلقائي بعد توقف الكتابة، ويُحفظ فوراً عند مغادرة الشاشة
  const latest = useRef({ title, courseId, blocks });
  const dirty = useRef(false);
  useEffect(() => {
    latest.current = { title, courseId, blocks };
    if (!dirty.current) return;
    const t = setTimeout(() => {
      updateSummary(summary.id, { title: title.trim() || 'ملخص', courseId, blocks });
      dirty.current = false;
    }, 500);
    return () => clearTimeout(t);
  }, [title, courseId, blocks, summary.id, updateSummary]);
  useEffect(
    () => () => {
      if (dirty.current) updateSummary(summary.id, { ...latest.current, title: latest.current.title.trim() || 'ملخص' });
    },
    [summary.id, updateSummary],
  );

  const change = (next: Block[]) => {
    dirty.current = true;
    setBlocks(next);
  };
  const patch = (bid: string, p: Partial<Block>) => change(blocks.map((b) => (b.id === bid ? { ...b, ...p } : b)));
  const move = (i: number, d: -1 | 1) => {
    const j = i + d;
    if (j < 0 || j >= blocks.length) return;
    const next = [...blocks];
    [next[i], next[j]] = [next[j], next[i]];
    change(next);
  };
  const retype = (b: Block, type: BlockType) => {
    const nb = { ...block(type, b.text, b.extra), id: b.id };
    change(blocks.map((x) => (x.id === b.id ? nb : x)));
    setTyping(null);
  };
  const addBlock = (type: BlockType) => {
    if (blocks.length >= MAX_BLOCKS) return;
    change([...blocks, block(type)]);
  };
  const organize = () => {
    const made = structureText(pasted);
    if (!made.length) return;
    haptic.success();
    // الملخص بلا عنوان حقيقي يأخذ أول عنوان في النص
    const firstHeading = made.find((b) => b.type === 'heading')?.text;
    if (firstHeading && /^ملخص(\s·.*)?$/.test(title.trim())) setTitle(firstHeading.slice(0, 80));
    change([...blocks.filter((b) => b.text.trim() || b.extra?.trim()), ...made].slice(0, MAX_BLOCKS));
    setPasted('');
    setPasteOpen(false);
    setMode('view');
  };

  const course = courses.find((c) => c.id === courseId);
  const accent = course?.color ?? colors.primary;
  const stats = summaryStats(blocks);
  const deckLimit = !summary.deckId && !pro && decksCount >= FREE_LIMITS.decks;

  const toDeck = () => {
    if (deckLimit) return router.push('/pro');
    updateSummary(summary.id, { title: title.trim() || 'ملخص', courseId, blocks });
    dirty.current = false;
    const r = summaryToDeck(summary.id);
    if (r) {
      haptic.success();
      setDeckMsg(r);
    }
  };

  return (
    <Screen
      back
      title={mode === 'view' ? title || 'ملخص' : 'تحرير الملخص'}
      subtitle={[course?.name, `${stats.readMin} د قراءة`, stats.checks ? `راجعت ${stats.checked} من ${stats.checks}` : null].filter(Boolean).join(' · ')}
      right={
        <View style={{ flexDirection: 'row', gap: 4 }}>
          <HeaderButton icon="share-outline" label="مشاركة الملخص" onPress={() => Share.share({ message: toText({ title, blocks }, course?.name) }).catch(() => {})} />
          <HeaderButton
            icon="trash-outline"
            label="حذف الملخص"
            onPress={() =>
              confirm('حذف الملخص؟', 'لا يمكن التراجع. بطاقات المراجعة المصنوعة منه تبقى.', () => {
                dirty.current = false;
                deleteSummary(summary.id);
                router.back();
              })
            }
          />
        </View>
      }
    >
      <Segmented<'view' | 'edit'>
        value={mode}
        onChange={setMode}
        options={[
          { value: 'view', label: 'عرض' },
          { value: 'edit', label: 'تحرير' },
        ]}
      />

      {mode === 'edit' ? (
        <>
          <Card style={{ gap: spacing.md }}>
            <Field label="العنوان" value={title} onChangeText={(t) => { dirty.current = true; setTitle(t); }} placeholder="مثال: الفصل الثالث - الأشجار" />
            {courses.length > 0 && <CoursePicker value={courseId} onChange={(c) => { dirty.current = true; setCourseId(c); }} />}
          </Card>

          <Card style={{ gap: spacing.sm, borderColor: colors.primary, borderWidth: pasteOpen ? 1.5 : 0 }}>
            <Pressable accessibilityRole="button" onPress={() => setPasteOpen(!pasteOpen)} style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
              <Ionicons name="sparkles" size={20} color={colors.primary} />
              <AppText variant="label" style={{ flex: 1 }}>
                الصق نصاً ونظّمه تلقائياً
              </AppText>
              <Ionicons name={pasteOpen ? 'chevron-up' : 'chevron-down'} size={18} color={colors.textMuted} />
            </Pressable>
            {pasteOpen && (
              <>
                <Field multiline value={pasted} onChangeText={setPasted} placeholder={'# عنوان\n- نقطة\nالمصطلح: التعريف\nس: سؤال؟\nج: جواب\nمهم: معلومة\nF = m × a\n[ ] موضوع أراجعه'} style={{ minHeight: 180 }} />
                <AppText variant="tiny" muted>
                  نفهم العناوين (# أو سطر ينتهي بـ «:»)، والنقاط والترقيم، و«مصطلح: تعريف»، والأسئلة وأجوبتها، و«مهم:»، والقوانين، و[ ] للمراجعة.
                </AppText>
                <Button title="نظّم النص" icon="color-wand" disabled={!pasted.trim()} onPress={organize} />
              </>
            )}
          </Card>

          <SectionHeader title="المحتوى" />
          {blocks.map((b, i) => {
            const info = BLOCK_INFO[b.type];
            const two = b.type === 'term' || b.type === 'qa';
            return (
              <Card key={b.id} style={{ gap: spacing.sm, padding: spacing.md }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`نوع الكتلة: ${info.label}. اضغط للتغيير`}
                    onPress={() => setTyping(typing === b.id ? null : b.id)}
                    style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: colors.primarySoft, paddingHorizontal: 10, height: 30, borderRadius: radius.pill }}
                  >
                    <Ionicons name={info.icon as Icon} size={14} color={colors.primary} />
                    <AppText variant="tiny" color={colors.primary}>
                      {info.label}
                    </AppText>
                    <Ionicons name="chevron-down" size={12} color={colors.primary} />
                  </Pressable>
                  <View style={{ flex: 1 }} />
                  <IconBtn icon="arrow-up" label="تحريك للأعلى" onPress={() => move(i, -1)} disabled={i === 0} />
                  <IconBtn icon="arrow-down" label="تحريك للأسفل" onPress={() => move(i, 1)} disabled={i === blocks.length - 1} />
                  <IconBtn icon="close" label="حذف" onPress={() => change(blocks.filter((x) => x.id !== b.id))} />
                </View>
                {typing === b.id && (
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                    {BLOCK_ORDER.map((t) => (
                      <TypeChip key={t} type={t} selected={t === b.type} onPress={() => retype(b, t)} />
                    ))}
                  </View>
                )}
                <BlockInput value={b.text} onChange={(text) => patch(b.id, { text })} placeholder={info.placeholder} bold={b.type === 'heading' || two} ltr={b.type === 'formula'} multiline={!two && b.type !== 'heading'} />
                {two && <BlockInput value={b.extra ?? ''} onChange={(extra) => patch(b.id, { extra })} placeholder={info.extraPlaceholder!} multiline />}
              </Card>
            );
          })}
          <AppText variant="label" muted>
            أضف:
          </AppText>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
            {BLOCK_ORDER.map((t) => (
              <TypeChip key={t} type={t} plus onPress={() => addBlock(t)} />
            ))}
          </View>
          <Button title="تم" icon="checkmark" onPress={() => setMode('view')} />
        </>
      ) : (
        <>
          {blocks.every((b) => !b.text.trim() && !b.extra?.trim()) ? (
            <Card padded={false}>
              <EmptyState icon="create-outline" title="الملخص فارغ" message="انتقل إلى «تحرير» واكتب، أو الصق ملاحظاتك ونظّمها تلقائياً." />
            </Card>
          ) : (
            <Card style={{ gap: spacing.md }}>
              {blocks.some((b) => b.type === 'qa' && b.extra?.trim()) && (
                <Pressable accessibilityRole="switch" accessibilityState={{ checked: quiz }} onPress={() => { setQuiz(!quiz); setRevealed(new Set()); }} style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, alignSelf: 'flex-start', backgroundColor: quiz ? colors.fill : colors.surfaceAlt, paddingHorizontal: 12, height: 34, borderRadius: radius.pill }}>
                  <Ionicons name="eye-off" size={16} color={quiz ? '#FFFFFF' : colors.text} />
                  <AppText variant="tiny" color={quiz ? '#FFFFFF' : colors.text}>
                    اختبر نفسك: أخفِ الأجوبة والتعريفات
                  </AppText>
                </Pressable>
              )}
              {blocks.map((b) => (
                <ViewBlock
                  key={b.id}
                  b={b}
                  accent={accent}
                  hidden={quiz && (b.type === 'qa' || b.type === 'term') && !revealed.has(b.id)}
                  onReveal={() => setRevealed(new Set(revealed).add(b.id))}
                  onToggle={() => { haptic.tap(); patch(b.id, { done: !b.done }); }}
                />
              ))}
            </Card>
          )}

          <SectionHeader title="حوّله لمراجعة" />
          <Card style={{ gap: spacing.md }}>
            <AppText variant="caption" muted>
              {stats.cards
                ? `في ملخصك ${ar(stats.cards, CARDS)} جاهزة من المصطلحات والأسئلة المُجابة. تُراجع بالتكرار المتباعد فتثبت في ذاكرتك.`
                : 'أضف مصطلحات بتعريفاتها أو أسئلة بأجوبتها، وتتحول تلقائياً لبطاقات مراجعة.'}
            </AppText>
            {deckMsg ? (
              <>
                <AppText variant="label" color={colors.success}>
                  {deckMsg.added ? `أُضيفت ${ar(deckMsg.added, CARDS)} ✓` : 'البطاقات محدّثة، لا جديد ✓'}
                </AppText>
                <Button title="راجع البطاقات الآن" icon="play" onPress={() => router.push({ pathname: '/decks/[id]', params: { id: deckMsg.deckId } })} />
              </>
            ) : (
              <Button title={deckLimit ? 'ترقية إلى برو لمجموعة جديدة' : summary.deckId ? 'حدّث بطاقات هذا الملخص' : 'اصنع بطاقات مراجعة'} icon={deckLimit ? 'diamond' : 'albums'} disabled={!stats.cards} onPress={toDeck} />
            )}
            <Button title="مشاركة كنص (واتساب، ملاحظات)" variant="ghost" size="sm" icon="share-social-outline" onPress={() => Share.share({ message: toText({ title, blocks }, course?.name) }).catch(() => {})} />
          </Card>
        </>
      )}
    </Screen>
  );
}

function ViewBlock({ b, accent, hidden, onReveal, onToggle }: { b: Block; accent: string; hidden: boolean; onReveal: () => void; onToggle: () => void }) {
  const { colors } = useTheme();
  const t = b.text.trim();
  if (!t && !b.extra?.trim()) return null;
  switch (b.type) {
    case 'heading':
      return (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.sm }}>
          <View style={{ width: 5, height: 24, borderRadius: 3, backgroundColor: accent }} />
          <AppText variant="h2" style={{ flex: 1 }}>
            {t}
          </AppText>
        </View>
      );
    case 'text':
      return <AppText variant="body">{t}</AppText>;
    case 'point':
      return (
        <View style={{ flexDirection: 'row', gap: spacing.sm }}>
          <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: accent, marginTop: 9 }} />
          <AppText variant="body" style={{ flex: 1 }}>
            {t}
          </AppText>
        </View>
      );
    case 'term':
    case 'qa': {
      const isQ = b.type === 'qa';
      return (
        <Pressable accessibilityRole={hidden ? 'button' : undefined} accessibilityHint={hidden ? 'اضغط لإظهار الجواب' : undefined} disabled={!hidden} onPress={onReveal} style={{ backgroundColor: colors.surfaceAlt, borderRadius: radius.md, padding: spacing.md, gap: 4, borderRightWidth: 4, borderRightColor: accent }}>
          <View style={{ flexDirection: 'row', gap: 6, alignItems: 'flex-start' }}>
            <Ionicons name={isQ ? 'help-circle' : 'bookmark'} size={18} color={accent} style={{ marginTop: 3 }} />
            <AppText variant="h3" style={{ flex: 1 }}>
              {t}
            </AppText>
          </View>
          {hidden ? (
            <AppText variant="caption" color={colors.primary}>
              اضغط لإظهار {isQ ? 'الجواب' : 'التعريف'} 👀
            </AppText>
          ) : b.extra?.trim() ? (
            <AppText variant="body" muted>
              {b.extra.trim()}
            </AppText>
          ) : null}
        </Pressable>
      );
    }
    case 'important':
      return (
        <View style={{ flexDirection: 'row', gap: spacing.sm, backgroundColor: colors.warningSoft, borderRadius: radius.md, padding: spacing.md }}>
          <Ionicons name="alert-circle" size={20} color={colors.warning} />
          <AppText variant="label" color={colors.warning} style={{ flex: 1 }}>
            {t}
          </AppText>
        </View>
      );
    case 'formula':
      return (
        <View style={{ backgroundColor: colors.primarySoft, borderRadius: radius.md, paddingVertical: spacing.md, paddingHorizontal: spacing.lg, alignItems: 'center' }}>
          <AppText variant="h3" color={colors.primary} style={{ writingDirection: 'ltr', textAlign: 'center' }}>
            {t}
          </AppText>
        </View>
      );
    case 'check':
      return (
        <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: !!b.done }} onPress={onToggle} style={{ flexDirection: 'row', gap: spacing.sm, alignItems: 'center' }}>
          <Ionicons name={b.done ? 'checkbox' : 'square-outline'} size={22} color={b.done ? colors.success : colors.textMuted} />
          <AppText variant="body" muted={b.done} style={{ flex: 1, textDecorationLine: b.done ? 'line-through' : 'none' }}>
            {t}
          </AppText>
        </Pressable>
      );
  }
}

function BlockInput({ value, onChange, placeholder, bold, ltr, multiline }: { value: string; onChange: (v: string) => void; placeholder: string; bold?: boolean; ltr?: boolean; multiline?: boolean }) {
  const { colors } = useTheme();
  return (
    <TextInput
      value={value}
      onChangeText={onChange}
      placeholder={placeholder}
      placeholderTextColor={colors.textMuted}
      multiline={multiline}
      accessibilityLabel={placeholder}
      style={{
        minHeight: 44,
        borderRadius: radius.sm,
        backgroundColor: colors.surfaceAlt,
        paddingHorizontal: 12,
        paddingVertical: 10,
        color: colors.text,
        fontFamily: bold ? fonts.semibold : fonts.regular,
        fontSize: bold ? 16 : 15,
        textAlign: ltr ? 'left' : 'right',
        writingDirection: ltr ? 'ltr' : 'rtl',
        textAlignVertical: 'top',
      }}
    />
  );
}

function IconBtn({ icon, label, onPress, disabled }: { icon: Icon; label: string; onPress: () => void; disabled?: boolean }) {
  const { colors } = useTheme();
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} hitSlop={6} disabled={disabled} onPress={onPress} style={{ width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surfaceAlt, opacity: disabled ? 0.35 : 1 }}>
      <Ionicons name={icon} size={16} color={colors.text} />
    </Pressable>
  );
}

function TypeChip({ type, selected, plus, onPress }: { type: BlockType; selected?: boolean; plus?: boolean; onPress: () => void }) {
  const { colors } = useTheme();
  const info = BLOCK_INFO[type];
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={plus ? `إضافة ${info.label}` : info.label}
      onPress={onPress}
      style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, height: 34, borderRadius: radius.pill, borderWidth: 1.5, borderColor: selected ? colors.fill : colors.border, backgroundColor: selected ? colors.fill : colors.surface, opacity: pressed ? 0.8 : 1 })}
    >
      <Ionicons name={(plus ? 'add' : info.icon) as Icon} size={14} color={selected ? '#FFFFFF' : colors.primary} />
      <AppText variant="tiny" color={selected ? '#FFFFFF' : colors.text}>
        {info.label}
      </AppText>
    </Pressable>
  );
}
