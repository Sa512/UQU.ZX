import { beforeEach, describe, expect, it, jest } from '@jest/globals';

// eslint-disable-next-line @typescript-eslint/no-require-imports
jest.mock('@react-native-async-storage/async-storage', () => require('@react-native-async-storage/async-storage/jest/async-storage-mock'));

// eslint-disable-next-line import/first
import { parseSchedule } from '../scheduleImport';
// eslint-disable-next-line import/first
import { structureText } from '../summaries';
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

describe('store: leave a section channel', () => {
  beforeEach(() => useStore.getState().resetAll());

  it('keeps the course and its dates but stops syncing them', () => {
    const ch = { id: 'x', code: 'ABC234', course_name: 'هياكل البيانات', course_code: 'CS 2301', section_code: '1041', instructor: 'د. سارة', color: '#4F46E5', updated_at: '', posts: [],
      slots: [{ weekday: 0, start_min: 480, end_min: 580, type: 'lecture' as const, location: '' }], exams: [{ title: 'فصلي', date: '2026-10-20', type: 'exam' as const }] };
    const { courseId } = useStore.getState().applyChannel(ch);
    useStore.getState().leaveChannel(courseId);
    const s = useStore.getState();
    expect(s.courses[0].channel).toBeUndefined();
    expect(s.slots).toHaveLength(1);
    expect(s.slots[0].channelCode).toBeUndefined();
    expect(s.tasks[0].channelKey).toBeUndefined();
    // إعادة الانضمام لا تكرر الاختبار القديم لأنه صار مهمة عادية؟ بل تضيف نسخة مرتبطة جديدة: المهم ألا تحذف مواعيد الطالب
    useStore.getState().applyChannel({ ...ch, slots: [] });
    expect(useStore.getState().slots).toHaveLength(1);
  });
});

describe('store: summaries', () => {
  beforeEach(() => useStore.getState().resetAll());

  it('turns a summary into one deck and only adds new cards on later runs', () => {
    const { addCourse, addSummary, summaryToDeck, updateSummary, deleteCourse } = useStore.getState();
    const cid = addCourse({ name: 'هياكل', code: '', color: '#000', credits: 3, instructor: '' });
    const id = addSummary('الأشجار', cid, structureText('الجذر: أول عقدة\nما الورقة؟\nعقدة بلا أبناء\n- نقطة'));
    const r1 = summaryToDeck(id)!;
    expect(r1.added).toBe(2);
    const deck = useStore.getState().decks.find((d) => d.id === r1.deckId)!;
    expect(deck).toMatchObject({ title: 'ملخص: الأشجار', courseId: cid });
    expect(useStore.getState().summaries[0].deckId).toBe(r1.deckId);

    updateSummary(id, { blocks: [...useStore.getState().summaries[0].blocks, ...structureText('المكدس: آخر داخل أول خارج')] });
    const r2 = summaryToDeck(id)!;
    expect(r2).toEqual({ deckId: r1.deckId, added: 1 });
    expect(useStore.getState().decks).toHaveLength(1);
    expect(useStore.getState().decks[0].cards).toHaveLength(3);

    deleteCourse(cid);
    expect(useStore.getState().summaries[0].courseId).toBeNull();
  });

  it('tags imported calendar tasks with the detected system', () => {
    const { addFeed, applyIcs } = useStore.getState();
    const fid = addFeed('https://moodle.example.edu.sa/calendar/export_execute.php?x=1', 'Moodle');
    const soon = new Date(Date.now() + 3 * 86_400_000);
    applyIcs(fid, [{ uid: 'e1', summary: 'Quiz 1', start: soon, allDay: true, location: '', description: '', categories: '' }]);
    expect(useStore.getState().tasks[0].notes).toBe('من تقويم Moodle');
  });
});

describe('store: accounts on a shared device', () => {
  beforeEach(() => useStore.getState().resetAll());
  const prof = (id: string, role: 'student' | 'professor' = 'student') => ({ id, email: `${id}@uqu.edu.sa`, full_name: `مستخدم ${id}`, university: 'جامعة أم القرى', role, status: 'active' as const, is_admin: false });

  it('keeps data for the same account and starts clean for a different one', () => {
    const s = useStore.getState();
    s.setAccount(prof('a', 'professor'));
    s.updateSettings({ onboarded: true });
    s.addCourse({ name: 'مادة', code: '', color: '#000', credits: 3, instructor: '' });
    expect(useStore.getState().settings).toMatchObject({ role: 'professor', name: 'مستخدم a', university: 'جامعة أم القرى' });
    useStore.getState().setAccount(null);
    useStore.getState().setAccount(prof('a', 'professor'));
    expect(useStore.getState().courses).toHaveLength(1);
    useStore.getState().setAccount(null);
    useStore.getState().setAccount(prof('b'));
    expect(useStore.getState().courses).toHaveLength(0);
    expect(useStore.getState().settings).toMatchObject({ onboarded: false, role: 'student', lastAccountId: 'b' });
  });
});
