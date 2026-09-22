import { describe, expect, it } from '@jest/globals';
import { cumulativeGpa, gpaRating, gradeFromPercent, requiredTermGpa, round2, termGpa } from '../gpa';

describe('termGpa', () => {
  it('computes weighted GPA on the 5-point scale', () => {
    // (3×5 + 4×4.5 + 2×4) / 9 = 41 / 9
    const r = termGpa(
      [
        { credits: 3, grade: 'A+' },
        { credits: 4, grade: 'B+' },
        { credits: 2, grade: 'B' },
      ],
      5,
    );
    expect(r.credits).toBe(9);
    expect(round2(r.gpa)).toBe(4.56);
  });

  it('computes weighted GPA on the 4-point scale and counts F as 0', () => {
    const r = termGpa(
      [
        { credits: 3, grade: 'A' },
        { credits: 3, grade: 'F' },
      ],
      4,
    );
    expect(r.gpa).toBeCloseTo(1.875);
  });

  it('counts F as 1 on the 5-point scale', () => {
    expect(termGpa([{ credits: 3, grade: 'F' }], 5).gpa).toBe(1);
  });

  it('returns 0 with no courses and ignores zero-credit rows', () => {
    expect(termGpa([], 5).gpa).toBe(0);
    expect(termGpa([{ credits: 0, grade: 'A+' }], 5).credits).toBe(0);
  });
});

describe('cumulativeGpa', () => {
  it('merges previous record with this term', () => {
    // (4.0×60 + 5×15) / 75 = 4.2
    expect(cumulativeGpa(4, 60, [{ credits: 15, grade: 'A+' }], 5)).toBeCloseTo(4.2);
  });

  it('clamps an out-of-range previous GPA to the scale', () => {
    expect(cumulativeGpa(9, 10, [], 4)).toBe(4);
  });
});

describe('requiredTermGpa', () => {
  it('finds the GPA needed next term', () => {
    // target 4.0 over 75h from 3.8 over 60h → (300 - 228) / 15 = 4.8
    expect(requiredTermGpa(3.8, 60, 4, 15, 5)).toBeCloseTo(4.8);
  });

  it('returns null when impossible', () => {
    expect(requiredTermGpa(2, 100, 4.5, 15, 5)).toBeNull();
  });

  it('never returns less than the scale minimum', () => {
    expect(requiredTermGpa(4.9, 100, 3, 15, 5)).toBe(1);
  });
});

describe('grades', () => {
  it('maps percentages to letters at the boundaries', () => {
    expect(gradeFromPercent(95)).toBe('A+');
    expect(gradeFromPercent(94.9)).toBe('A');
    expect(gradeFromPercent(60)).toBe('D');
    expect(gradeFromPercent(59)).toBe('F');
  });

  it('rates GPAs per scale', () => {
    expect(gpaRating(4.5, 5)).toBe('ممتاز');
    expect(gpaRating(3.75, 5)).toBe('جيد جداً');
    expect(gpaRating(3.5, 4)).toBe('ممتاز');
    expect(gpaRating(0.5, 4)).toBe('دون المقبول');
  });
});
