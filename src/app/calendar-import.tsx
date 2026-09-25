import { useState } from 'react';
import { Platform, View } from 'react-native';
import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { confirm } from '@/components/confirm';
import { Field } from '@/components/Field';
import { haptic } from '@/components/haptics';
import { Screen, SectionHeader } from '@/components/Screen';
import { formatShortDate } from '@/lib/dates';
import { normalizeFeedUrl, parseIcs } from '@/lib/ical';
import { fetchIcs } from '@/lib/icsFetch';
import { pickTextFile, textFileSupported } from '@/lib/textFile';
import { useStore } from '@/store/useStore';
import { spacing, useTheme } from '@/theme';

const STEPS = [
  'افتح Blackboard من المتصفح، ثم «التقويم».',
  'اضغط أيقونة الإعدادات أو «مشاركة التقويم»، ثم انسخ الرابط.',
  'الصق الرابط هنا واضغط «استيراد».',
];

/** استيراد الواجبات والاختبارات من تقويم Blackboard (أو أي نظام يعطي رابط iCal). */
export default function CalendarImport() {
  const { colors } = useTheme();
  const feeds = useStore((s) => s.feeds);
  const addFeed = useStore((s) => s.addFeed);
  const removeFeed = useStore((s) => s.removeFeed);
  const applyIcs = useStore((s) => s.applyIcs);
  const [url, setUrl] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string }>();

  const report = (r: { added: number; updated: number }) =>
    setMsg({ ok: true, text: r.added || r.updated ? `أُضيف ${r.added} موعد${r.updated ? `، وحُدّث ${r.updated}` : ''} ✓ تجدها في المهام.` : 'لا مواعيد جديدة، كل شيء محدّث ✓' });

  const importUrl = async (raw: string, existingId?: string) => {
    const u = normalizeFeedUrl(raw);
    if (!u) return setMsg({ ok: false, text: 'الرابط غير صحيح. انسخ رابط «مشاركة التقويم» كما هو من Blackboard (يبدأ بـ https أو webcal).' });
    setBusy(existingId ?? 'new');
    setMsg(undefined);
    try {
      const events = await fetchIcs(u);
      const id = existingId ?? addFeed(u, new URL(u).hostname);
      report(applyIcs(id, events));
      haptic.success();
      if (!existingId) setUrl('');
    } catch (e) {
      setMsg({ ok: false, text: Platform.OS === 'web' ? 'المتصفح يمنع جلب التقويم من موقع آخر. جرّبه في تطبيق الجوال.' : (e as Error).message });
    } finally {
      setBusy(null);
    }
  };

  const importFile = async () => {
    const text = await pickTextFile();
    if (!text) return;
    try {
      report(applyIcs('file', parseIcs(text)));
      haptic.success();
    } catch {
      setMsg({ ok: false, text: 'الملف ليس تقويماً صالحاً (.ics).' });
    }
  };

  return (
    <Screen back title="مواعيد Blackboard" subtitle="واجباتك واختباراتك تدخل المهام تلقائياً">
      <Card style={{ gap: spacing.sm }}>
        {STEPS.map((s, i) => (
          <View key={s} style={{ flexDirection: 'row', gap: spacing.sm }}>
            <AppText variant="label" color={colors.primary}>
              {i + 1}.
            </AppText>
            <AppText variant="body" style={{ flex: 1 }}>
              {s}
            </AppText>
          </View>
        ))}
        <AppText variant="caption" muted>
          🔒 الرابط خاص بك: يبقى على جوالك فقط، ولا يُرسل لخادمنا، ولا يدخل النسخ الاحتياطية. لا نطلب كلمة مرور البوابة أبداً.
        </AppText>
      </Card>

      <Card style={{ gap: spacing.md }}>
        <Field label="رابط التقويم" placeholder="https://… أو webcal://…" value={url} onChangeText={setUrl} autoCapitalize="none" autoCorrect={false} keyboardType="url" ltr />
        <Button title="استيراد" icon="cloud-download-outline" loading={busy === 'new'} disabled={!url.trim()} onPress={() => importUrl(url)} />
        {textFileSupported && <Button title="أو من ملف ‎.ics" variant="ghost" size="sm" icon="document-outline" onPress={importFile} />}
      </Card>

      {msg && (
        <AppText variant="label" center color={msg.ok ? colors.success : colors.danger}>
          {msg.text}
        </AppText>
      )}

      {feeds.length > 0 && (
        <>
          <SectionHeader title="التقاويم المرتبطة" />
          <Card padded={false}>
            {feeds.map((f, i) => (
              <View key={f.id} style={{ padding: spacing.lg, gap: spacing.sm, borderTopWidth: i ? 1 : 0, borderColor: colors.border }}>
                <AppText variant="label">{f.label}</AppText>
                <AppText variant="tiny" muted>
                  {f.lastSync ? `آخر تحديث ${formatShortDate(new Date(f.lastSync))} · ${f.lastCount} موعد في التقويم` : 'لم يُحدَّث بعد'} · يتحدّث تلقائياً كل 6 ساعات
                </AppText>
                <View style={{ flexDirection: 'row', gap: spacing.sm }}>
                  <Button style={{ flex: 1 }} title="تحديث" size="sm" variant="secondary" icon="refresh" loading={busy === f.id} onPress={() => importUrl(f.url, f.id)} />
                  <Button
                    style={{ flex: 1 }}
                    title="إزالة"
                    size="sm"
                    variant="ghost"
                    icon="trash-outline"
                    onPress={() => confirm('إزالة التقويم؟', 'تُحذف مواعيده القادمة غير المنجزة من المهام.', () => removeFeed(f.id), 'إزالة')}
                  />
                </View>
              </View>
            ))}
          </Card>
        </>
      )}
    </Screen>
  );
}
