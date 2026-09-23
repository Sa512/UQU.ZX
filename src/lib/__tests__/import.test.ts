import { describe, expect, it } from '@jest/globals';
import { studentAttendance } from '../attendance';
import { parseTable, toCsv } from '../csv';
import { parseRoster } from '../roster';
import { parseDays, parseRange, parseSchedule, parseTime } from '../scheduleImport';

describe('parseTable / toCsv', () => {
  it('detects tabs (pasted from Excel) and commas with quotes', () => {
    expect(parseTable('a\tb\n1\t2')).toEqual([['a', 'b'], ['1', '2']]);
    expect(parseTable('name,note\n"سارة، أحمد","قال ""مرحبا"""')).toEqual([['name', 'note'], ['سارة، أحمد', 'قال "مرحبا"']]);
  });
  it('writes Excel-friendly CSV with BOM', () => {
    expect(toCsv([['الاسم', 'ملاحظة'], ['أ', 'x,y']])).toBe('﻿الاسم,ملاحظة\r\nأ,"x,y"');
  });
});

describe('parseRoster', () => {
  it('reads a roster with Arabic headers in any order', () => {
    const r = parseRoster('الرقم الجامعي\tالاسم\tالبريد الإلكتروني\n443001122\tسارة محمد\tS443001122@uqu.edu.sa\n443001133\tنورة علي\t');
    expect(r).toEqual([
      { name: 'سارة محمد', uniId: '443001122', email: 's443001122@uqu.edu.sa', phone: '' },
      { name: 'نورة علي', uniId: '443001133', email: '', phone: '' },
    ]);
  });
  it('infers columns without headers, converts Arabic digits, skips duplicates', () => {
    const r = parseRoster('خالد أحمد, ٤٤٢٠٠٠١١١, k@uqu.edu.sa, 0551234567\nخالد أحمد, 442000111, k@uqu.edu.sa\nفهد, 442000222');
    expect(r).toHaveLength(2);
    expect(r[0]).toEqual({ name: 'خالد أحمد', uniId: '442000111', email: 'k@uqu.edu.sa', phone: '0551234567' });
    expect(r[1].name).toBe('فهد');
  });
});

describe('schedule import', () => {
  it('parses days in many forms', () => {
    expect(parseDays('ح ث خ')).toEqual([0, 2, 4]);
    expect(parseDays('حثخ')).toEqual([0, 2, 4]);
    expect(parseDays('الأحد، الثلاثاء')).toEqual([0, 2]);
    expect(parseDays('1 3 5')).toEqual([0, 2, 4]);
    expect(parseDays('Mon Wed')).toEqual([1, 3]);
  });
  it('parses times and ranges', () => {
    expect(parseTime('08:00')).toBe(480);
    expect(parseTime('1:30 م')).toBe(810);
    expect(parseTime('01:30')).toBe(810);
    expect(parseTime('12:00 م')).toBe(720);
    expect(parseRange('08:00 - 09:40')).toEqual([480, 580]);
    expect(parseRange('١٠:٠٠–١١:٤٠')).toEqual([600, 700]);
  });
  it('reads a portal-style table and expands multi-day rows', () => {
    const text = [
      'رمز المقرر\tاسم المقرر\tالشعبة\tالأيام\tالوقت\tالقاعة\tالنوع',
      'CS 2301\tهياكل البيانات\t1041\tح ث\t08:00 - 09:40\tمبنى 5 - 204\tمحاضرة',
      'CS 2301\tهياكل البيانات\t1041\tخ\t01:00 - 03:00\tمعمل 3\tعملي',
      '\t\t\tن\t10:00 - 11:00\tمكتب 3-214\tساعات مكتبية',
    ].join('\n');
    const r = parseSchedule(text);
    expect(r.skipped).toBe(0);
    expect(r.slots).toHaveLength(4);
    expect(r.slots[3]).toMatchObject({ course: '', day: 1, start: 600, end: 660, type: 'office' });
    expect(r.slots[0]).toMatchObject({ course: 'CS 2301', courseName: 'هياكل البيانات', section: '1041', day: 0, start: 480, end: 580, room: 'مبنى 5 - 204', type: 'lecture' });
    expect(r.slots[2]).toMatchObject({ day: 4, start: 780, end: 900, type: 'lab' });
  });
});

describe('studentAttendance', () => {
  it('counts absences per student', () => {
    const recs = [
      { id: 'r1', sectionId: 's', date: '2026-09-20', absent: ['a', 'b'] },
      { id: 'r2', sectionId: 's', date: '2026-09-22', absent: ['a'] },
    ];
    const r = studentAttendance(['a', 'b', 'c'], recs, 2, 15);
    expect(r.map((x) => x.absences)).toEqual([2, 1, 0]);
    expect(r[0].status.allowed).toBe(7);
  });
});
