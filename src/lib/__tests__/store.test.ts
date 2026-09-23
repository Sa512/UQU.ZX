import { beforeEach, describe, expect, it, jest } from '@jest/globals';

// eslint-disable-next-line @typescript-eslint/no-require-imports
jest.mock('@react-native-async-storage/async-storage', () => require('@react-native-async-storage/async-storage/jest/async-storage-mock'));

// eslint-disable-next-line import/first
import { parseSchedule } from '../scheduleImport';
// eslint-disable-next-line import/first
import { useStore } from '@/store/useStore';

describe('store: faculty features', () => {
  beforeEach(() => useStore.getState().resetAll());

  it('imports a schedule, creating courses and sections once', () => {
    const text = 'رمز المقرر\tاسم المقرر\tالشعبة\tالأيام\tالوقت\tالقاعة\nCS 2301\tهياكل البيانات\t1041\tح ث\t08:00-09:40\t204\nCS 2301\tهياكل البيانات\t1042\tن\t10:00-11:40\t205\n\t\t\tر\t12:00-13:00\tساعات مكتبية';
    const r = useStore.getState().importSchedule(parseSchedule(text).slots, true);
    const s = useStore.getState();
    expect(r).toEqual({ courses: 1, slots: 4 });
    expect(s.courses).toHaveLength(1);
    expect(s.courses[0]).toMatchObject({ name: 'هياكل البيانات', code: 'CS 2301' });
    expect(s.sections.map((x) => x.code).sort()).toEqual(['1041', '1042']);
    expect(s.slots.filter((x) => x.type === 'office')).toHaveLength(1);
    expect(s.slots.find((x) => x.type === 'office')?.courseId).toBe('');
    // استيراد ثانٍ لا يكرر المقرر
    useStore.getState().importSchedule(parseSchedule(text).slots, true);
    expect(useStore.getState().courses).toHaveLength(1);
    expect(useStore.getState().slots).toHaveLength(4);
  });

  it('adds students without duplicates and cleans up on delete', () => {
    const cid = useStore.getState().addCourse({ name: 'م', code: '', color: '#000', credits: 3, instructor: '' });
    const sid = useStore.getState().addSection(cid, '1041');
    const r1 = useStore.getState().addStudents(sid, [
      { name: 'سارة', uniId: '1', email: 'a@x.sa', phone: '' },
      { name: 'نورة', uniId: '2', email: '', phone: '' },
    ]);
    const r2 = useStore.getState().addStudents(sid, [{ name: 'سارة', uniId: '1', email: '', phone: '' }]);
    expect(r1).toEqual({ added: 2, skipped: 0 });
    expect(r2).toEqual({ added: 0, skipped: 1 });
    const [a] = useStore.getState().students;
    useStore.getState().saveAttendance(sid, '2026-09-20', [a.id]);
    useStore.getState().saveAttendance(sid, '2026-09-20', []); // تعديل نفس اليوم
    expect(useStore.getState().attendance).toHaveLength(1);
    useStore.getState().deleteCourse(cid);
    const s = useStore.getState();
    expect([s.sections.length, s.students.length, s.attendance.length]).toEqual([0, 0, 0]);
  });
});

describe('store: gradebook and new semester', () => {
  beforeEach(() => useStore.getState().resetAll());

  it('stores scores and cleans them up with the student, item and course', () => {
    const st = useStore.getState();
    const cid = st.addCourse({ name: 'م', code: '', color: '#000', credits: 3, instructor: '' });
    const sid = st.addSection(cid, '1');
    st.addStudents(sid, [{ name: 'أ', uniId: '1', email: '', phone: '' }, { name: 'ب', uniId: '2', email: '', phone: '' }]);
    const [a, b] = useStore.getState().students;
    const item = st.addGradeItem(sid, 'فصلي', 20);
    st.setScores(item, { [a.id]: 18, [b.id]: 12 });
    st.setScores(item, { [b.id]: null });
    expect(Object.keys(useStore.getState().scores)).toEqual([`${item}:${a.id}`]);
    st.deleteStudent(a.id);
    expect(useStore.getState().scores).toEqual({});
    st.setScores(item, { [b.id]: 15 });
    st.deleteCourse(cid);
    const s = useStore.getState();
    expect([s.gradeItems.length, Object.keys(s.scores).length]).toEqual([0, 0]);
  });

  it('closes a semester into the cumulative GPA and resets absences', () => {
    const st = useStore.getState();
    st.addCourse({ name: 'م', code: '', color: '#000', credits: 3, instructor: '', absences: 4 });
    st.setGpa({ prevGpa: 4, prevCredits: 60, rows: [{ id: 'r', name: 'م', credits: 15, grade: 'A+' }] });
    st.addTasks([{ title: 't', courseId: null, type: 'exam', due: '2026-10-01', priority: 2, notes: '' }]);
    st.startNewSemester({ mergeGpa: true, clearSchedule: true, clearTasks: true, clearCourses: false });
    const s = useStore.getState();
    expect(s.gpa).toEqual({ prevGpa: 4.2, prevCredits: 75, rows: [] });
    expect(s.courses[0].absences).toBe(0);
    expect(s.tasks).toHaveLength(0);
  });
});
