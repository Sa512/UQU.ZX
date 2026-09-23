import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Field } from '@/components/Field';
import { haptic } from '@/components/haptics';
import { Screen } from '@/components/Screen';
import { Segmented } from '@/components/Segmented';
import { DAY_NAMES, formatMinutes } from '@/lib/dates';
import { SLOT_TYPES } from '@/lib/labels';
import { ar, COURSES, SLOTS } from '@/lib/plural';
import { parseSchedule } from '@/lib/scheduleImport';
import { pickTextFile, textFileSupported } from '@/lib/textFile';
import { useStore } from '@/store/useStore';
import { spacing, useTheme } from '@/theme';

const SAMPLE = [
  'رمز المقرر\tاسم المقرر\tالشعبة\tالأيام\tالوقت\tالقاعة\tالنوع',
  'CS 2301\tهياكل البيانات\t1041\tح ث\t08:00 - 09:40\tمبنى 5 - 204\tمحاضرة',
  'CS 2301\tهياكل البيانات\t1042\tن ر\t10:00 - 11:40\tمبنى 5 - 110\tمحاضرة',
  'CS 3302\tقواعد البيانات\t1051\tخ\t01:00 - 03:00\tمعمل 3\tعملي',
  '\t\t\tن ر\t12:00 - 01:00\tمكتب 3-214\tساعات مكتبية',
].join('\n');

export default function ScheduleImport() {
  const { colors } = useTheme();
  const importSchedule = useStore((s) => s.importSchedule);
  const existing = useStore((s) => s.slots.length);
  const [text, setText] = useState('');
  const [mode, setMode] = useState<'replace' | 'append'>('replace');
  const [done, setDone] = useState<string>();
  const { slots, skipped } = parseSchedule(text);

  const run = () => {
    const r = importSchedule(slots, mode === 'replace');
    haptic.success();
    setDone(`تمت إضافة ${ar(r.slots, SLOTS)}${r.courses ? ` و${ar(r.courses, COURSES)} جديدة` : ''}`);
    setTimeout(() => router.dismissTo('/schedule'), 1000);
  };

  return (
    <Screen
      close
      title="استيراد الجدول"
      footer={<Button title={slots.length ? `استيراد ${ar(slots.length, SLOTS)}` : 'الصق الجدول أولاً'} size="lg" icon="cloud-download-outline" disabled={!slots.length} onPress={run} />}
    >
      <Card style={{ gap: spacing.sm, backgroundColor: colors.infoSoft, borderColor: 'transparent' }}>
        <AppText variant="h3">من بوابة الجامعة أو Excel</AppText>
        <AppText variant="caption">1. افتح جدولك في بوابة الجامعة (أو ملف Excel) وظلّل الجدول كاملاً مع العناوين.</AppText>
        <AppText variant="caption">2. انسخه والصقه هنا. نفهم الأيام (ح ن ث ر خ أو الأسماء كاملة) والأوقات (08:00 - 09:40) والشعب والقاعات.</AppText>
        <AppText variant="caption">3. راجع المعاينة ثم استورد — وتقدر تعدّل أي حصة بعدها.</AppText>
      </Card>
      <Field label="الجدول" placeholder="الصق هنا…" multiline value={text} onChangeText={(t) => { setText(t); setDone(undefined); }} style={{ minHeight: 160 }} />
      <View style={{ flexDirection: 'row', gap: spacing.sm }}>
        {textFileSupported && (
          <Button style={{ flex: 1 }} size="sm" variant="secondary" icon="document-outline" title="اختيار ملف CSV" onPress={async () => { const t = await pickTextFile(); if (t !== null) setText(t); }} />
        )}
        <Button style={{ flex: 1 }} size="sm" variant="ghost" title="جرّب مثالاً" onPress={() => setText(SAMPLE)} />
      </View>
      {existing > 0 && slots.length > 0 && (
        <Segmented
          value={mode}
          onChange={setMode}
          options={[
            { value: 'replace', label: 'استبدال جدولي الحالي' },
            { value: 'append', label: 'إضافة إليه' },
          ]}
        />
      )}
      {slots.length > 0 && (
        <Card style={{ gap: 8 }}>
          <AppText variant="h3">معاينة ({ar(slots.length, SLOTS)})</AppText>
          {slots.slice(0, 12).map((s, i) => (
            <AppText key={i} variant="caption">
              {DAY_NAMES[s.day]} · {formatMinutes(s.start)}–{formatMinutes(s.end)} · {s.courseName || SLOT_TYPES[s.type].label}
              {s.section ? ` · شعبة ${s.section}` : ''}
              {s.room ? ` · ${s.room}` : ''}
            </AppText>
          ))}
          {skipped > 0 && (
            <AppText variant="caption" color={colors.warning}>
              تجاهلنا {skipped} صفاً لم نجد فيه يوماً أو وقتاً.
            </AppText>
          )}
        </Card>
      )}
      {text.trim() !== '' && slots.length === 0 && (
        <AppText variant="caption" color={colors.danger}>
          لم نتعرّف على أيام وأوقات في النص. تأكد من نسخ الجدول مع عمودي الأيام والوقت.
        </AppText>
      )}
      {done && (
        <AppText variant="label" color={colors.success} center>
          {done} ✓
        </AppText>
      )}
    </Screen>
  );
}
