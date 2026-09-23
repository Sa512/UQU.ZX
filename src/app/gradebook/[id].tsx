import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Chip, ChipRow } from '@/components/Chip';
import { confirm } from '@/components/confirm';
import { EmptyState } from '@/components/EmptyState';
import { Field } from '@/components/Field';
import { haptic } from '@/components/haptics';
import { Pill } from '@/components/Rows';
import { Screen, SectionHeader } from '@/components/Screen';
import { Segmented } from '@/components/Segmented';
import { latinDigits, toCsv } from '@/lib/csv';
import { toDateKey } from '@/lib/dates';
import { fileExportSupported, shareCsv } from '@/lib/exportIO';
import { GRADES } from '@/lib/gpa';
import { distribution, itemStats, matchScores, scoreKey, studentTotals } from '@/lib/gradebook';
import { ar, STUDENTS } from '@/lib/plural';
import { useStore } from '@/store/useStore';
import { radius, spacing, useTheme } from '@/theme';

const num = (s: string) => {
  const v = parseFloat(latinDigits(s).replace(',', '.'));
  return Number.isFinite(v) ? v : null;
};

export default function Gradebook() {
  const { colors } = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const section = useStore((s) => s.sections.find((x) => x.id === id));
  const course = useStore((s) => s.courses.find((c) => c.id === section?.courseId));
  const allStudents = useStore((s) => s.students);
  const allItems = useStore((s) => s.gradeItems);
  const scores = useStore((s) => s.scores);
  const { addGradeItem, deleteGradeItem, setScores } = useStore.getState();
  const [tab, setTab] = useState<'entry' | 'totals'>('entry');
  const [itemId, setItemId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [newName, setNewName] = useState('');
  const [newOutOf, setNewOutOf] = useState('');
  const [paste, setPaste] = useState('');
  const [showPaste, setShowPaste] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string }>();

  if (!section || !course) {
    return (
      <Screen back title="الدرجات">
        <EmptyState icon="alert-circle-outline" title="الشعبة غير موجودة" />
      </Screen>
    );
  }
  const students = allStudents.filter((x) => x.sectionId === section.id).sort((a, b) => a.name.localeCompare(b.name, 'ar'));
  const items = allItems.filter((x) => x.sectionId === section.id);
  const item = items.find((x) => x.id === itemId) ?? items[0];
  const planned = items.reduce((a, x) => a + x.outOf, 0);
  const totals = studentTotals(students.map((s) => s.id), items, scores);
  const dist = distribution(totals);

  const select = (iid: string) => {
    setItemId(iid);
    setDraft({});
    setMsg(undefined);
  };
  const valueOf = (sid: string) => (item ? (draft[sid] ?? (scores[scoreKey(item.id, sid)] !== undefined ? String(scores[scoreKey(item.id, sid)]) : '')) : '');

  const addItem = () => {
    const o = num(newOutOf);
    if (newName.trim().length < 2 || !o || o <= 0 || o > 100) return setMsg({ ok: false, text: 'اكتب اسم التقييم ودرجته (1–100)' });
    const nid = addGradeItem(section.id, newName, o);
    setNewName('');
    setNewOutOf('');
    select(nid);
  };

  const save = () => {
    if (!item) return;
    const values: Record<string, number | null> = {};
    let bad = 0;
    for (const [sid, raw] of Object.entries(draft)) {
      const v = raw.trim() === '' ? null : num(raw);
      if (v !== null && (v < 0 || v > item.outOf)) {
        bad++;
        continue;
      }
      values[sid] = v;
    }
    setScores(item.id, values);
    setDraft({});
    haptic.success();
    setMsg(bad ? { ok: false, text: `حُفظت الدرجات، وتجاهلنا ${bad} خارج النطاق (0–${item.outOf})` } : { ok: true, text: 'حُفظ الرصد ✓' });
  };

  const applyPaste = () => {
    if (!item) return;
    const r = matchScores(paste, students, item.outOf);
    const n = Object.keys(r.matched).length;
    setDraft((d) => ({ ...d, ...Object.fromEntries(Object.entries(r.matched).map(([k, v]) => [k, String(v)])) }));
    setShowPaste(false);
    setPaste('');
    setMsg({ ok: n > 0, text: `طابقنا ${ar(n, STUDENTS)}${r.unmatched ? ` · ${r.unmatched} صف بلا مطابقة` : ''}${r.overMax ? ` · ${r.overMax} أعلى من ${item.outOf}` : ''} — راجع ثم احفظ` });
  };

  const exportSheet = async () => {
    const head = ['الاسم', 'الرقم الجامعي', ...items.map((x) => `${x.name} (${x.outOf})`), `المجموع (${planned})`, 'النسبة', 'التقدير'];
    const rows: (string | number)[][] = [head];
    students.forEach((s, i) => {
      const t = totals[i];
      rows.push([s.name, s.uniId, ...items.map((x) => scores[scoreKey(x.id, s.id)] ?? ''), t.total, t.pct === null ? '' : `${Math.round(t.pct * 100)}%`, t.grade ?? '']);
    });
    const r = await shareCsv(`درجات-${course.code || course.name}-${section.code}-${toDateKey(new Date())}.csv`.replace(/\s+/g, '-'), toCsv(rows));
    if (!r.ok) setMsg({ ok: false, text: r.message ?? 'تعذّر التصدير' });
  };

  const st = item ? itemStats(item, students.map((s) => s.id), scores) : null;

  return (
    <Screen
      back
      title={`درجات شعبة ${section.code}`}
      subtitle={`${course.name} · ${ar(students.length, STUDENTS)} · التوزيع ${planned} من 100`}
      footer={tab === 'entry' && item && Object.keys(draft).length > 0 ? <Button title="حفظ الرصد" size="lg" icon="checkmark" onPress={save} /> : undefined}
    >
      {students.length === 0 ? (
        <Card padded={false}>
          <EmptyState icon="people-outline" title="أضف طلاب الشعبة أولاً" />
        </Card>
      ) : (
        <>
          <Segmented
            value={tab}
            onChange={setTab}
            options={[
              { value: 'entry', label: 'رصد الدرجات' },
              { value: 'totals', label: 'المجاميع والتقديرات' },
            ]}
          />

          {tab === 'entry' && (
            <>
              <ChipRow>
                {items.map((x) => (
                  <Chip key={x.id} label={`${x.name} (${x.outOf})`} selected={item?.id === x.id} onPress={() => select(x.id)} />
                ))}
              </ChipRow>
              <Card style={{ gap: spacing.sm }}>
                <AppText variant="label">تقييم جديد</AppText>
                <View style={{ flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-start' }}>
                  <View style={{ flex: 1 }}>
                    <Field placeholder="مثال: الاختبار الفصلي الأول" value={newName} onChangeText={setNewName} />
                  </View>
                  <View style={{ width: 84 }}>
                    <Field accessibilityLabel="من كم" placeholder="من" keyboardType="number-pad" value={newOutOf} onChangeText={setNewOutOf} ltr style={{ textAlign: 'center' }} />
                  </View>
                </View>
                <Button title="إضافة التقييم" size="sm" variant="secondary" icon="add" onPress={addItem} />
                {planned > 100 && (
                  <AppText variant="caption" color={colors.danger}>
                    مجموع التوزيع {planned} ويتجاوز 100.
                  </AppText>
                )}
              </Card>

              {item && (
                <>
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                    <AppText variant="h3" style={{ flex: 1 }}>
                      {item.name} — من {item.outOf}
                    </AppText>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel="حذف التقييم"
                      hitSlop={8}
                      onPress={() => confirm('حذف التقييم؟', `ستُحذف درجات «${item.name}» لكل الطلاب.`, () => deleteGradeItem(item.id))}
                    >
                      <Ionicons name="trash-outline" size={20} color={colors.danger} />
                    </Pressable>
                  </View>
                  {st && st.count > 0 && (
                    <AppText variant="caption" muted>
                      رُصد لـ {ar(st.count, STUDENTS)} · المتوسط {st.avg} · الأعلى {st.max} · الأدنى {st.min}
                    </AppText>
                  )}
                  {showPaste ? (
                    <Card style={{ gap: spacing.sm }}>
                      <AppText variant="caption">الصق عمودين من Excel: الرقم الجامعي (أو الاسم) والدرجة.</AppText>
                      <Field accessibilityLabel="الدرجات الملصوقة" multiline placeholder="443001122	18" value={paste} onChangeText={setPaste} style={{ minHeight: 110 }} />
                      <View style={{ flexDirection: 'row', gap: spacing.sm }}>
                        <Button style={{ flex: 1 }} size="sm" title="مطابقة" onPress={applyPaste} disabled={!paste.trim()} />
                        <Button style={{ flex: 1 }} size="sm" variant="ghost" title="إلغاء" onPress={() => setShowPaste(false)} />
                      </View>
                    </Card>
                  ) : (
                    <Button title="لصق الدرجات من Excel" size="sm" variant="ghost" icon="clipboard-outline" onPress={() => setShowPaste(true)} />
                  )}
                  <Card padded={false}>
                    {students.map((s, i) => (
                      <View key={s.id} style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.md, paddingVertical: 8, borderTopWidth: i ? 1 : 0, borderTopColor: colors.border }}>
                        <View style={{ flex: 1 }}>
                          <AppText variant="label" numberOfLines={1}>
                            {s.name}
                          </AppText>
                          {!!s.uniId && (
                            <AppText variant="tiny" muted>
                              {s.uniId}
                            </AppText>
                          )}
                        </View>
                        <View style={{ width: 80 }}>
                          <Field
                            accessibilityLabel={`درجة ${s.name}`}
                            placeholder="—"
                            keyboardType="decimal-pad"
                            value={valueOf(s.id)}
                            onChangeText={(t) => setDraft((d) => ({ ...d, [s.id]: t }))}
                            ltr
                            style={{ minHeight: 42, textAlign: 'center', borderColor: draft[s.id] !== undefined ? colors.primary : undefined }}
                          />
                        </View>
                        <AppText variant="caption" muted>
                          /{item.outOf}
                        </AppText>
                      </View>
                    ))}
                  </Card>
                </>
              )}
              {!items.length && (
                <AppText variant="caption" muted center>
                  أضف أول تقييم (مثل الاختبار الفصلي الأول من 20) ثم ارصد درجات الطلاب.
                </AppText>
              )}
            </>
          )}

          {tab === 'totals' && (
            <>
              <Card style={{ gap: spacing.sm }}>
                <AppText variant="h3">توزيع التقديرات</AppText>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                  {GRADES.filter((g) => dist[g]).map((g) => (
                    <View key={g} style={{ flexDirection: 'row', gap: 4, alignItems: 'center', backgroundColor: g === 'F' ? colors.dangerSoft : colors.surfaceAlt, borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 3 }}>
                      <AppText variant="label" color={g === 'F' ? colors.danger : colors.text}>
                        {g}
                      </AppText>
                      <AppText variant="caption" muted>
                        {dist[g]}
                      </AppText>
                    </View>
                  ))}
                  {!Object.keys(dist).length && (
                    <AppText variant="caption" muted>
                      لا درجات مرصودة بعد.
                    </AppText>
                  )}
                </View>
                <AppText variant="tiny" muted>
                  التقدير محسوب على ما رُصد حتى الآن ({planned} من 100 موزعة).
                </AppText>
              </Card>
              <SectionHeader title="الطلاب" />
              <Card padded={false}>
                {[...totals]
                  .sort((a, b) => (b.pct ?? -1) - (a.pct ?? -1))
                  .map((t, i) => {
                    const s = students.find((x) => x.id === t.studentId)!;
                    return (
                      <View key={t.studentId} style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md, borderTopWidth: i ? 1 : 0, borderTopColor: colors.border }}>
                        <View style={{ flex: 1 }}>
                          <AppText variant="label" numberOfLines={1}>
                            {s.name}
                          </AppText>
                          <AppText variant="tiny" muted>
                            {t.outOf ? `${t.total} من ${t.outOf} · ${Math.round((t.pct ?? 0) * 100)}%` : 'لم يُرصد'}
                            {t.missing && t.outOf ? ` · ينقص ${t.missing}` : ''}
                          </AppText>
                        </View>
                        {t.grade && <Pill label={t.grade} tone={t.grade === 'F' ? 'danger' : t.grade.startsWith('D') ? 'warning' : 'success'} />}
                      </View>
                    );
                  })}
              </Card>
              {fileExportSupported && <Button title="تصدير الدرجات (Excel)" icon="document-text-outline" variant="secondary" onPress={exportSheet} />}
            </>
          )}
          {msg && (
            <AppText variant="label" center color={msg.ok ? colors.success : colors.danger}>
              {msg.text}
            </AppText>
          )}
        </>
      )}
    </Screen>
  );
}
