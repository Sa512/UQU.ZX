import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Field } from '@/components/Field';
import { haptic } from '@/components/haptics';
import { Screen } from '@/components/Screen';
import { pickTextFile, textFileSupported } from '@/lib/textFile';
import { ar, STUDENTS } from '@/lib/plural';
import { parseRoster } from '@/lib/roster';
import { useStore } from '@/store/useStore';
import { spacing, useTheme } from '@/theme';

const SAMPLE = 'الاسم\tالرقم الجامعي\tالبريد الإلكتروني\nسارة محمد\t443001122\ts443001122@uqu.edu.sa\nنورة علي\t443001133\ts443001133@uqu.edu.sa';

export default function RosterImport() {
  const { colors } = useTheme();
  const { sectionId } = useLocalSearchParams<{ sectionId: string }>();
  const section = useStore((s) => s.sections.find((x) => x.id === sectionId));
  const addStudents = useStore((s) => s.addStudents);
  const [text, setText] = useState('');
  const [result, setResult] = useState<string>();
  const rows = parseRoster(text);

  const doImport = () => {
    const r = addStudents(sectionId, rows);
    haptic.success();
    setResult(`أُضيف ${ar(r.added, STUDENTS)}${r.skipped ? ` · تجاهلنا ${r.skipped} مكرراً` : ''}`);
    setTimeout(() => router.back(), 900);
  };

  return (
    <Screen
      close
      title="استيراد قائمة الطلاب"
      subtitle={section ? `شعبة ${section.code}` : undefined}
      footer={<Button title={rows.length ? `استيراد ${ar(rows.length, STUDENTS)}` : 'الصق القائمة أولاً'} size="lg" icon="cloud-download-outline" disabled={!rows.length} onPress={doImport} />}
    >
      <Card style={{ gap: spacing.sm, backgroundColor: colors.infoSoft, borderColor: 'transparent' }}>
        <AppText variant="h3">الطريقة</AppText>
        <AppText variant="caption">1. افتح كشف الشعبة في Excel أو النظام الأكاديمي أو بلاك بورد.</AppText>
        <AppText variant="caption">2. حدّد الأعمدة (الاسم، الرقم الجامعي، البريد) وانسخها.</AppText>
        <AppText variant="caption">3. الصقها هنا — نتعرّف على الأعمدة تلقائياً ولو بدون عناوين.</AppText>
      </Card>
      <Field label="القائمة" placeholder="الصق هنا…" multiline value={text} onChangeText={(t) => { setText(t); setResult(undefined); }} style={{ minHeight: 160 }} />
      <View style={{ flexDirection: 'row', gap: spacing.sm }}>
        {textFileSupported && (
          <Button
            style={{ flex: 1 }}
            size="sm"
            variant="secondary"
            icon="document-outline"
            title="اختيار ملف CSV"
            onPress={async () => {
              const t = await pickTextFile();
              if (t !== null) setText(t);
            }}
          />
        )}
        <Button style={{ flex: 1 }} size="sm" variant="ghost" title="جرّب مثالاً" onPress={() => setText(SAMPLE)} />
      </View>
      {rows.length > 0 && (
        <Card style={{ gap: 6 }}>
          <AppText variant="h3">معاينة ({rows.length})</AppText>
          {rows.slice(0, 8).map((r, i) => (
            <AppText key={i} variant="caption">
              {r.name} {r.uniId ? `· ${r.uniId}` : ''} {r.email ? `· ${r.email}` : ''}
            </AppText>
          ))}
          {rows.length > 8 && (
            <AppText variant="caption" muted>
              و{rows.length - 8} آخرون…
            </AppText>
          )}
        </Card>
      )}
      {text.trim() !== '' && rows.length === 0 && (
        <AppText variant="caption" color={colors.danger}>
          لم نتعرّف على أسماء أو أرقام جامعية في النص. تأكد من نسخ أعمدة الكشف.
        </AppText>
      )}
      {result && (
        <AppText variant="label" color={colors.success} center>
          {result} ✓
        </AppText>
      )}
    </Screen>
  );
}
