import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { cloud } from '@/lib/cloud';
import { formatShortDate } from '@/lib/dates';
import { unreadPosts } from '@/lib/sectionChannel';
import { useStore, type Course } from '@/store/useStore';
import { spacing, useTheme } from '@/theme';
import { AppText } from './AppText';
import { Button } from './Button';
import { Card } from './Card';
import { haptic } from './haptics';

/** للطالب: إعلانات الدكتور وتحديث مواعيد الشعبة. */
export function ChannelCard({ course }: { course: Course }) {
  const { colors } = useTheme();
  const applyChannel = useStore((s) => s.applyChannel);
  const markSeen = useStore((s) => s.markChannelSeen);
  // الإعلانات غير المقروءة لحظة الفتح تبقى مميزة حتى مغادرة الصفحة
  const [fresh] = useState(() => new Set(unreadPosts(course).map((p) => p.id)));
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string }>();
  const [all, setAll] = useState(false);
  const ch = course.channel!;
  const latest = ch.posts[0]?.created_at;

  useEffect(() => {
    Promise.resolve().then(() => markSeen(course.id));
  }, [course.id, latest, markSeen]);

  const refresh = async () => {
    setBusy(true);
    setMsg(undefined);
    try {
      const r = await cloud.getSection(ch.code);
      if (!r) return setMsg({ ok: false, text: 'أوقف الدكتور هذه القناة.' });
      const res = applyChannel(r);
      haptic.success();
      const parts = [res.added.exams && `${res.added.exams} موعد جديد`, res.changedExams && `${res.changedExams} موعد تغيّر`].filter(Boolean);
      setMsg({ ok: true, text: parts.length ? `حُدّثت: ${parts.join(' · ')}` : 'كل شيء محدّث ✓' });
    } catch (e) {
      setMsg({ ok: false, text: (e as Error).message });
    } finally {
      setBusy(false);
    }
  };

  const posts = all ? ch.posts : ch.posts.slice(0, 3);
  return (
    <Card style={{ gap: spacing.md }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <AppText variant="h3">📣 من {course.instructor}</AppText>
        <AppText variant="tiny" muted>
          شعبة {ch.section || '—'} · الرمز {ch.code}
        </AppText>
      </View>
      {posts.length === 0 ? (
        <AppText variant="caption" muted>
          لا توجد إعلانات بعد. تصلك هنا أي تغييرات في المواعيد والاختبارات.
        </AppText>
      ) : (
        posts.map((p) => (
          <View key={p.id} style={{ gap: 2, paddingStart: spacing.md, borderStartWidth: 3, borderColor: fresh.has(p.id) ? colors.primary : colors.border }}>
            <AppText variant="body">{p.body}</AppText>
            <AppText variant="tiny" muted>
              {formatShortDate(new Date(p.created_at))}
              {fresh.has(p.id) ? ' · جديد' : ''}
            </AppText>
          </View>
        ))
      )}
      {ch.posts.length > 3 && !all && <Button title={`عرض كل الإعلانات (${ch.posts.length})`} variant="ghost" size="sm" onPress={() => setAll(true)} />}
      <Button title="تحديث من الدكتور" icon="refresh" variant="secondary" size="sm" loading={busy} onPress={refresh} />
      {msg && (
        <AppText variant="caption" color={msg.ok ? colors.success : colors.danger}>
          {msg.text}
        </AppText>
      )}
    </Card>
  );
}
