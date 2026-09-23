import { describe, expect, it } from '@jest/globals';
import { summarize, type Assessment } from '../grades';

const a = (name: string, outOf: number, got: number | null): Assessment => ({ id: name, courseId: 'c', name, outOf, got });

describe('summarize', () => {
  it('handles an empty course', () => {
    const s = summarize([]);
    expect(s).toMatchObject({ earned: 0, graded: 0, remaining: 100, pct: null, projected: null, best: 100 });
    expect(s.targets.find((t) => t.grade === 'A+')).toEqual({ grade: 'A+', need: 95, status: 'possible' });
  });

  it('computes what is needed in the remaining marks', () => {
    // فصلي أول 17/20، فصلي ثاني 18/20، النهائي لم يُرصد (60)
    const s = summarize([a('mid1', 20, 17), a('mid2', 20, 18), a('final', 60, null)]);
    expect(s).toMatchObject({ earned: 35, graded: 40, remaining: 60, planned: 100, best: 95 });
    expect(s.pct).toBeCloseTo(0.875);
    expect(s.projected).toBe('B+');
    const t = Object.fromEntries(s.targets.map((x) => [x.grade, x]));
    expect(t['A+']).toEqual({ grade: 'A+', need: 60, status: 'possible' });
    expect(t.A.need).toBe(55);
    expect(t.D.need).toBe(25);
  });

  it('marks secured and impossible grades', () => {
    const s = summarize([a('work', 40, 20), a('final', 60, null)]);
    expect(s.targets.find((x) => x.grade === 'A+')?.status).toBe('impossible'); // 20 + 60 = 80 < 95
    expect(s.targets.find((x) => x.grade === 'B')?.status).toBe('possible');
    const done = summarize([a('all', 100, 91)]);
    expect(done.targets.find((x) => x.grade === 'A')?.status).toBe('secured');
    expect(done.targets.find((x) => x.grade === 'A+')?.status).toBe('impossible');
    expect(done.projected).toBe('A');
  });

  it('clamps scores to the item maximum', () => {
    expect(summarize([a('q', 10, 14)]).earned).toBe(10);
  });
});
