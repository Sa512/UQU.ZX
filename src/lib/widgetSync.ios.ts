/** آيفون وآيباد: يحدّث ويدجت الشاشة الرئيسية بجدول زمني لليوم كلما تغيرت بياناتك. */
import { useStore } from '@/store/useStore';
import { widgetTimeline } from './widgetData';

type W = { updateTimeline(entries: ReturnType<typeof widgetTimeline>): void };
let widget: W | null | undefined;

function load(): W | null {
  if (widget !== undefined) return widget;
  try {
    // تحميل متأخر: في Expo Go لا توجد وحدة الويدجت، فيبقى التطبيق يعمل بدونها
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    widget = require('../widgets/MudhakerNext').default as W;
  } catch {
    widget = null;
  }
  return widget;
}

export function refreshWidget(now = Date.now()) {
  const w = load();
  if (!w) return;
  const s = useStore.getState();
  try {
    w.updateTimeline(widgetTimeline({ courses: s.courses, slots: s.slots, tasks: s.tasks, sessions: s.sessions, goal: s.settings.dailyGoalMin, professor: s.settings.role === 'professor' }, now));
  } catch {
    // الويدجت ميزة إضافية: أي خطأ فيه لا يمس التطبيق
  }
}

export const widgetsSupported = true;
