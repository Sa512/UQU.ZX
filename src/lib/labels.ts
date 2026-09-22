import type { Ionicons } from '@expo/vector-icons';
import type { Role, SlotType, TaskType } from '@/store/useStore';

type IconName = keyof typeof Ionicons.glyphMap;

export const TASK_TYPES: Record<TaskType, { label: string; icon: IconName }> = {
  assignment: { label: 'واجب', icon: 'document-text-outline' },
  exam: { label: 'اختبار', icon: 'school-outline' },
  quiz: { label: 'اختبار قصير', icon: 'help-circle-outline' },
  project: { label: 'مشروع', icon: 'construct-outline' },
  reading: { label: 'قراءة', icon: 'book-outline' },
  grading: { label: 'تصحيح', icon: 'create-outline' },
};

/** أنواع المهام المناسبة لكل دور: الدكتور يصحّح ويعدّ الاختبارات، والطالب يسلّم ويذاكر. */
export const TASK_TYPES_BY_ROLE: Record<Role, TaskType[]> = {
  student: ['assignment', 'exam', 'quiz', 'project', 'reading'],
  professor: ['grading', 'exam', 'quiz', 'assignment', 'reading'],
};

export const SLOT_TYPES: Record<SlotType, { label: string; icon: IconName }> = {
  lecture: { label: 'محاضرة', icon: 'easel-outline' },
  lab: { label: 'معمل', icon: 'flask-outline' },
  office: { label: 'ساعات مكتبية', icon: 'people-outline' },
};

export const PRIORITY: Record<1 | 2 | 3, { label: string }> = {
  1: { label: 'منخفضة' },
  2: { label: 'متوسطة' },
  3: { label: 'عالية' },
};

export const ROLE_LABEL: Record<Role, string> = { student: 'طالب', professor: 'عضو هيئة تدريس' };
