import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { View } from 'react-native';
import { AppText } from '@/components/AppText';
import { Card } from '@/components/Card';
import { EmptyState } from '@/components/EmptyState';
import { TaskRow } from '@/components/Rows';
import { HeaderButton, Screen } from '@/components/Screen';
import { Segmented } from '@/components/Segmented';
import { diffDays, fromDateKey } from '@/lib/dates';
import { useStore, type Task } from '@/store/useStore';
import { spacing, useTheme } from '@/theme';

type Filter = 'open' | 'exams' | 'done';

function group(tasks: Task[]) {
  const now = new Date();
  const g: Record<string, Task[]> = { 'متأخرة': [], 'اليوم': [], 'هذا الأسبوع': [], 'لاحقاً': [] };
  for (const t of tasks) {
    const n = diffDays(now, fromDateKey(t.due));
    if (n < 0) g['متأخرة'].push(t);
    else if (n === 0) g['اليوم'].push(t);
    else if (n <= 7) g['هذا الأسبوع'].push(t);
    else g['لاحقاً'].push(t);
  }
  return Object.entries(g).filter(([, v]) => v.length);
}

export default function Tasks() {
  const { colors } = useTheme();
  const tasks = useStore((s) => s.tasks);
  const [filter, setFilter] = useState<Filter>('open');

  const list = useMemo(() => {
    const sorted = [...tasks].sort((a, b) => a.due.localeCompare(b.due) || b.priority - a.priority);
    if (filter === 'done') return sorted.filter((t) => t.done).reverse();
    if (filter === 'exams') return sorted.filter((t) => !t.done && (t.type === 'exam' || t.type === 'quiz'));
    return sorted.filter((t) => !t.done);
  }, [tasks, filter]);

  const doneCount = tasks.filter((t) => t.done).length;
  const pct = tasks.length ? Math.round((doneCount / tasks.length) * 100) : 0;

  return (
    <Screen inTabs title="المهام" subtitle={`أنجزت ${doneCount} من ${tasks.length} (${pct}%)`} right={<HeaderButton icon="add" label="مهمة جديدة" onPress={() => router.push('/task/new')} />}>
      <View style={{ height: 8, borderRadius: 4, backgroundColor: colors.surfaceAlt, overflow: 'hidden' }}>
        <View style={{ width: `${pct}%`, height: '100%', backgroundColor: colors.success, borderRadius: 4 }} />
      </View>
      <Segmented<Filter>
        value={filter}
        onChange={setFilter}
        options={[
          { value: 'open', label: 'القادمة' },
          { value: 'exams', label: 'الاختبارات' },
          { value: 'done', label: 'المنجزة' },
        ]}
      />
      {list.length === 0 ? (
        <Card padded={false}>
          <EmptyState
            icon={filter === 'done' ? 'trophy-outline' : 'checkmark-done-outline'}
            title={filter === 'done' ? 'لم تنجز مهاماً بعد' : 'كل شيء تحت السيطرة'}
            message={filter === 'done' ? 'المهام التي تنجزها ستظهر هنا.' : 'لا توجد مهام قادمة. أضف واجباً أو اختباراً.'}
            action={filter === 'done' ? undefined : { title: 'إضافة مهمة', onPress: () => router.push('/task/new') }}
          />
        </Card>
      ) : filter === 'done' ? (
        <View style={{ gap: spacing.sm }}>
          {list.map((t) => (
            <TaskRow key={t.id} task={t} />
          ))}
        </View>
      ) : (
        group(list).map(([title, items]) => (
          <View key={title} style={{ gap: spacing.sm }}>
            <AppText variant="label" color={title === 'متأخرة' ? colors.danger : colors.textMuted}>
              {title} · {items.length}
            </AppText>
            {items.map((t) => (
              <TaskRow key={t.id} task={t} />
            ))}
          </View>
        ))
      )}
    </Screen>
  );
}
