import { describe, expect, it } from '@jest/globals';
import { emailKind, sameName, signupProblem, usersCsv } from '../accounts';
import { createDemoApi, DEMO_ADMIN, DEMO_CODE } from '../cloud/demoApi';

describe('university emails', () => {
  it('tells students from staff like the server', () => {
    expect(emailKind('s441012345@st.uqu.edu.sa')).toEqual({ kind: 'student', university: 'جامعة أم القرى' });
    expect(emailKind('441012345@student.ksu.edu.sa').kind).toBe('student');
    expect(emailKind('441099999@uqu.edu.sa').kind).toBe('student');
    expect(emailKind('SM.Harbi@UQU.edu.sa')).toEqual({ kind: 'staff', university: 'جامعة أم القرى' });
    expect(emailKind('dr.ali@cs.ksu.edu.sa').kind).toBe('staff');
    expect(emailKind('k@newuni.edu.sa').kind).toBe('unknown');
    expect(emailKind('x@st.newuni.edu.sa').kind).toBe('student');
    expect(emailKind('me@gmail.com').kind).toBe('not_university');
    expect(emailKind('evil@uqu.edu.sa.evil.com').kind).toBe('not_university');
    expect(emailKind('dr@fakeuqu.edu.sa').kind).toBe('unknown');
  });

  it('explains signup problems in Arabic', () => {
    expect(signupProblem('me@gmail.com', '12345678', 'student')).toContain('إيميلك الجامعي');
    expect(signupProblem('s441@st.uqu.edu.sa', '12345678', 'professor')).toContain('إيميل طالب');
    expect(signupProblem('dr@uqu.edu.sa', '123', 'professor')).toContain('8 خانات');
    expect(signupProblem('dr@uqu.edu.sa', '12345678', 'professor')).toBeNull();
    expect(signupProblem('ASD1911147@gmail.com', '12345678', 'student')).toBeNull(); // المشرف
  });

  it('exports users to an Excel-safe CSV', () => {
    const csv = usersCsv([{ email: 'a@uqu.edu.sa', full_name: '=HYPERLINK("x")', university: 'جامعة أم القرى', role: 'professor', status: 'pending', created_at: '2026-09-28T10:20:30Z', last_seen_at: '', bookings: 2, open_pages: 1 }]);
    expect(csv.startsWith('﻿الاسم,الإيميل')).toBe(true);
    expect(csv).toContain(`"'=HYPERLINK(""x"")",a@uqu.edu.sa,جامعة أم القرى,عضو هيئة تدريس,بانتظار الموافقة,2026-09-28 10:20,,2,1`);
  });
});

describe('demo accounts and office-hours directory', () => {
  const t = Date.UTC(2026, 9, 5, 6, 0);
  it('signs up with a code, derives roles, lists professors of the same university', async () => {
    const api = createDemoApi(() => t);
    // دكتور
    await api.signUp('sm.harbi@uqu.edu.sa', 'secret123');
    await expect(api.verifyEmail('sm.harbi@uqu.edu.sa', '000000')).rejects.toMatchObject({ code: 'bad_code' });
    await api.verifyEmail('SM.HARBI@uqu.edu.sa', DEMO_CODE);
    expect(await api.completeProfile('د. سارة الحربي', 'professor', '')).toMatchObject({ status: 'active', university: 'جامعة أم القرى' });
    const { code } = await api.publishPage({ title: 'ساعاتي', host_name: 'مزيف', slot_minutes: 15, windows: [{ weekday: 1, start_min: 600, end_min: 660, location: '' }] });
    await api.signOut();
    // طالب لا يسجل كدكتور
    await api.signUp('s441012345@st.uqu.edu.sa', 'secret123');
    await api.verifyEmail('s441012345@st.uqu.edu.sa', DEMO_CODE);
    await expect(api.completeProfile('نورة', 'professor', '')).rejects.toMatchObject({ code: 'student_email' });
    await api.completeProfile('نورة', 'student', '');
    const hosts = await api.listOfficeHosts('');
    expect(hosts.find((h) => h.code === code)?.host_name).toBe('د. سارة الحربي');
    expect((await api.listOfficeHosts('سارة')).some((h) => h.code === code)).toBe(true);
    // الحجز من الدليل بالرمز الداخلي
    await api.book(code, '2026-10-05T10:00:00+03:00', 'نورة', '', '');
    await expect(api.adminOverview()).rejects.toMatchObject({ code: 'not_allowed' });
    await expect(api.signIn('s441012345@st.uqu.edu.sa', 'wrong')).rejects.toMatchObject({ code: 'invalid_credentials' });
  });

  it('keeps unknown-university professors pending until the admin approves', async () => {
    const api = createDemoApi(() => t);
    await api.signUp('k@newuni.edu.sa', 'secret123');
    await api.verifyEmail('k@newuni.edu.sa', DEMO_CODE);
    const p = await api.completeProfile('د. خالد', 'professor', 'جامعة جديدة');
    expect(p.status).toBe('pending');
    await api.signOut();
    await api.signUp(DEMO_ADMIN, 'secret123');
    await api.verifyEmail(DEMO_ADMIN, DEMO_CODE);
    expect((await api.completeProfile('المشرف', 'student', '')).is_admin).toBe(true);
    expect(await api.adminOverview()).toMatchObject({ pending: 1, students: 1 });
    await api.adminSetUser(p.id, 'professor', 'active');
    expect((await api.adminUsers('خالد', null, null))[0].status).toBe('active');
    expect(await api.adminExport()).toHaveLength(2);
    await api.deleteAccount();
    await expect(api.myProfile()).resolves.toBeNull();
  });
});

describe('matching instructors to professors', () => {
  it('ignores titles, hamzas and middle names', () => {
    expect(sameName('د. سارة الحربي', 'سارة محمد الحربي')).toBe(true);
    expect(sameName('الدكتورة سارة الحربى', 'د.سارة الحربي')).toBe(true);
    expect(sameName('Dr. Ahmed Ali', 'ahmed ali')).toBe(true);
    expect(sameName('د. سارة الحربي', 'د. سارة العتيبي')).toBe(false);
    expect(sameName('د. سارة', 'سارة الحربي')).toBe(false); // كلمة واحدة لا تكفي
    expect(sameName('', 'سارة')).toBe(false);
  });
});
