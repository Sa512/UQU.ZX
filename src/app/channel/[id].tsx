import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, Share, View } from 'react-native';
import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { confirm } from '@/components/confirm';
import { EmptyState } from '@/components/EmptyState';
import { Field } from '@/components/Field';
import { haptic } from '@/components/haptics';
import { QrCode } from '@/components/QrCode';
import { Screen, SectionHeader } from '@/components/Screen';
import { cloud, type ChannelPost } from '@/lib/cloud';
import { formatShortDate } from '@/lib/dates';
import { ar, LECTURES } from '@/lib/plural';
import { buildChannel, joinLink } from '@/lib/sectionChannel';
import { useStore } from '@/store/useStore';
import { radius, spacing, useTheme } from '@/theme';

const EXAMS = { one: 'اختبار واحد', two: 'اختبارين', few: 'اختبارات', many: 'اختباراً' };

/** قناة الشعبة (للدكتور): نشر الجدول والاختبارات برمز، وإرسال الإعلانات للطلاب. */
export default function ChannelScreen() {
  const { colors } = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const section = useStore((s) => s.sections.find((x) => x.id === id));
  const course = useStore((s) => s.courses.find((c) => c.id === section?.courseId));
  const slots = useStore((s) => s.slots);
  const tasks = useStore((s) => s.tasks);
  const name = useStore((s) => s.settings.name);
  const updateSection = useStore((s) => s.updateSection);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string }>();
  const [posts, setPosts] = useState<ChannelPost[]>([]);
  const [draft, setDraft] = useState('');
  const code = section?.channel?.code;

  const load = useCallback(async () => {
    if (!code) return;
    try {
      const ch = await cloud.getSection(code);
      setPosts(ch?.posts ?? []);
    } catch (e) {
      setMsg({ ok: false, text: (e as Error).message });
    }
  }, [code]);

  useEffect(() => {
    // تحميل الإعلانات عند الفتح (خارج دورة الرسم حتى لا يتكرر)
    Promise.resolve().then(load);
  }, [load]);

  if (!section || !course) {
    return (
      <Screen back title="قناة الشعبة">
        <EmptyState icon="alert-circle-outline" title="الشعبة غير موجودة" />
      </Screen>
    );
  }

  const payload = buildChannel({ course, section, slots, tasks, instructor: name || course.instructor, today: new Date() });

  const publish = async () => {
    setBusy(true);
    setMsg(undefined);
    try {
      const r = await cloud.publishSection({ ...payload, id: section.channel?.id });
      updateSection(section.id, { channel: { id: r.id, code: r.code } });
      haptic.success();
      setMsg({ ok: true, text: section.channel ? 'وصل التحديث لطلابك ✓' : 'نُشرت الشعبة ✓ شارك الرمز مع طلابك.' });
    } catch (e) {
      setMsg({ ok: false, text: (e as Error).message });
    } finally {
      setBusy(false);
    }
  };

  const send = async () => {
    if (!section.channel || !draft.trim()) return;
    setBusy(true);
    setMsg(undefined);
    try {
      await cloud.postToSection(section.channel.id, draft);
      setDraft('');
      haptic.success();
      await load();
    } catch (e) {
      setMsg({ ok: false, text: (e as Error).message });
    } finally {
      setBusy(false);
    }
  };

  const remove = (p: ChannelPost) =>
    confirm('حذف الإعلان؟', 'يختفي من عند الطلاب عند تحديثهم.', async () => {
      try {
        await cloud.deletePost(p.id);
        await load();
      } catch (e) {
        setMsg({ ok: false, text: (e as Error).message });
      }
    });

  const shareMsg = code
    ? `انضم لشعبة ${course.name} (${section.code}) في تطبيق مذاكر، وتوصلك المحاضرات ومواعيد الاختبارات والإعلانات:\nالمزيد ← انضم لشعبة ← الرمز: ${code}\n${joinLink(code)}`
    : '';

  return (
    <Screen back title="قناة الشعبة" subtitle={`${course.name} · شعبة ${section.code}`}>
      {!code ? (
        <Card style={{ gap: spacing.md }}>
          <AppText variant="h3">انشر شعبتك لطلابك</AppText>
          <AppText variant="body" muted>
            الطالب يمسح الرمز فتُضاف المادة عنده بمحاضراتها ومواعيد اختباراتها، وتصله إعلاناتك وأي تغيير في المواعيد.
          </AppText>
          <View style={{ gap: 6 }}>
            <AppText variant="label">
              سيُنشر: {ar(payload.slots.length, LECTURES)} أسبوعياً · مواعيد الاختبارات القادمة: {ar(payload.exams.length, EXAMS)}
            </AppText>
            <AppText variant="caption" muted>
              لا يُنشر أي شيء عن طلابك: لا أسماء ولا أرقام ولا حضور.
            </AppText>
          </View>
          <Button title="انشر الشعبة" icon="radio-outline" size="lg" loading={busy} onPress={publish} />
        </Card>
      ) : (
        <>
          <Card style={{ alignItems: 'center', gap: spacing.md }}>
            <QrCode value={joinLink(code)} size={180} />
            <View style={{ backgroundColor: colors.surfaceAlt, borderRadius: radius.md, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm }}>
              <AppText variant="title" style={{ letterSpacing: 4, writingDirection: 'ltr' }} accessibilityLabel={`رمز الشعبة ${code}`}>
                {code}
              </AppText>
            </View>
            <AppText variant="caption" muted center>
              اعرضه في أول محاضرة، أو أرسله في قروب الشعبة.
            </AppText>
            <View style={{ flexDirection: 'row', gap: spacing.sm, alignSelf: 'stretch' }}>
              <Button style={{ flex: 1 }} title="مشاركة" icon="share-outline" variant="secondary" onPress={() => Share.share({ message: shareMsg }).catch(() => {})} />
              <Button style={{ flex: 1 }} title="تحديث" icon="refresh" variant="ghost" loading={busy} onPress={publish} />
            </View>
            <AppText variant="tiny" muted center>
              المنشور الآن: {ar(payload.slots.length, LECTURES)} · {ar(payload.exams.length, EXAMS)}. عدّل الجدول أو المهام ثم اضغط «تحديث».
            </AppText>
          </Card>

          <SectionHeader title="إعلان للشعبة" />
          <Card style={{ gap: spacing.sm }}>
            <Field multiline placeholder="مثال: تأجيل الاختبار الفصلي إلى الأحد القادم" value={draft} onChangeText={(t) => setDraft(t.slice(0, 500))} accessibilityLabel="نص الإعلان" />
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <AppText variant="tiny" muted>
                {draft.length}/500
              </AppText>
              <Button title="إرسال" icon="megaphone-outline" size="sm" loading={busy} disabled={!draft.trim()} onPress={send} />
            </View>
          </Card>

          <SectionHeader title="الإعلانات المرسلة" />
          {posts.length === 0 ? (
            <AppText variant="caption" muted center>
              لم ترسل إعلانات بعد.
            </AppText>
          ) : (
            <Card padded={false}>
              {posts.map((p, i) => (
                <View key={p.id} style={{ flexDirection: 'row', gap: spacing.md, padding: spacing.lg, borderTopWidth: i ? 1 : 0, borderColor: colors.border }}>
                  <View style={{ flex: 1, gap: 4 }}>
                    <AppText variant="body">{p.body}</AppText>
                    <AppText variant="tiny" muted>
                      {formatShortDate(new Date(p.created_at))}
                    </AppText>
                  </View>
                  <Pressable accessibilityRole="button" accessibilityLabel="حذف الإعلان" hitSlop={8} onPress={() => remove(p)}>
                    <Ionicons name="trash-outline" size={20} color={colors.textMuted} />
                  </Pressable>
                </View>
              ))}
            </Card>
          )}
        </>
      )}

      {msg && (
        <AppText variant="label" center color={msg.ok ? colors.success : colors.danger}>
          {msg.text}
        </AppText>
      )}
      {!cloud.real && (
        <AppText variant="tiny" muted center>
          وضع تجريبي: الرمز يعمل على هذا الجهاز فقط حتى ربط الخادم.
        </AppText>
      )}
    </Screen>
  );
}
