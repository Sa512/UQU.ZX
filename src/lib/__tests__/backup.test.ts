import { describe, expect, it } from '@jest/globals';
import { backupFileName, buildBackup, parseBackup, type BackupData } from '../backup';

const data: BackupData = {
  settings: { name: 'ريم', semesterWeeks: 16 },
  courses: [{ id: 'c1', name: 'هياكل', code: 'CS', color: '#4F46E5', credits: 3, instructor: '', absences: 2 }],
  slots: [],
  tasks: [],
  sessions: [],
  decks: [],
  assessments: [{ id: 'a1', courseId: 'c1', name: 'فصلي', outOf: 20, got: 18 }],
  sections: [],
  students: [],
  attendance: [],
  gradeItems: [],
  scores: {},
  gpa: { prevGpa: 4, prevCredits: 30, rows: [] },
};

describe('backup', () => {
  it('round-trips through JSON', () => {
    const r = parseBackup(JSON.stringify(buildBackup(data, new Date(2026, 8, 22))));
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.data.courses[0].absences).toBe(2);
      expect(r.data.settings.name).toBe('ريم');
      expect(r.summary).toContain('1 مقرر');
      expect(r.data.assessments).toHaveLength(1);
    }
  });

  it('rejects junk, other apps, newer versions and broken files', () => {
    expect(parseBackup('not json').ok).toBe(false);
    expect(parseBackup(JSON.stringify({ app: 'other', version: 1, data })).ok).toBe(false);
    expect(parseBackup(JSON.stringify({ app: 'mudhaker', version: 99, data })).ok).toBe(false);
    expect(parseBackup(JSON.stringify({ app: 'mudhaker', version: 1, data: { ...data, tasks: null } })).ok).toBe(false);
  });

  it('names files by date', () => {
    expect(backupFileName(new Date(2026, 0, 5))).toBe('mudhaker-backup-2026-01-05.json');
  });
});
