import { describe, expect, it } from '@jest/globals';
import { block, sanitizeSummaries, structureText, summaryStats, TEMPLATES, toCards, toText } from '../summaries';

const NOTES = `# المحاضرة الثالثة: الأشجار
التعريفات:
- الشجرة الثنائية: شجرة لكل عقدة فيها ابنان على الأكثر
- العقدة الورقية - عقدة بلا أبناء
1. الارتفاع يساوي أطول مسار من الجذر
مهم: البحث في الشجرة المتوازنة O(log n)
h = log2(n)
القوة = الكتلة × التسارع
س: ما الفرق بين الشجرة والرسم البياني؟
ج: الشجرة لا تحتوي دوائر
ما هو الجذر؟
أول عقدة في الشجرة
[ ] مراجعة الاجتياز
[x] حل التمارين
الأشجار تستخدم في قواعد البيانات والملفات.`;

describe('structureText', () => {
  const b = structureText(NOTES);
  const types = b.map((x) => x.type);

  it('turns pasted notes into typed blocks', () => {
    expect(types).toEqual(['heading', 'heading', 'term', 'term', 'point', 'important', 'formula', 'formula', 'qa', 'qa', 'check', 'check', 'text']);
    expect(b[0].text).toBe('المحاضرة الثالثة: الأشجار');
    expect(b[1].text).toBe('التعريفات');
    expect(b[2]).toMatchObject({ text: 'الشجرة الثنائية', extra: 'شجرة لكل عقدة فيها ابنان على الأكثر' });
    expect(b[3]).toMatchObject({ text: 'العقدة الورقية', extra: 'عقدة بلا أبناء' });
    expect(b[4].text).toBe('الارتفاع يساوي أطول مسار من الجذر');
    expect(b[5].text).toBe('البحث في الشجرة المتوازنة O(log n)');
  });

  it('pairs questions with answers (explicit or next line)', () => {
    expect(b[8]).toMatchObject({ text: 'ما الفرق بين الشجرة والرسم البياني؟', extra: 'الشجرة لا تحتوي دوائر' });
    expect(b[9]).toMatchObject({ text: 'ما هو الجذر؟', extra: 'أول عقدة في الشجرة' });
  });

  it('reads checklists and keeps long sentences as text', () => {
    expect(b[10]).toMatchObject({ text: 'مراجعة الاجتياز', done: false });
    expect(b[11]).toMatchObject({ text: 'حل التمارين', done: true });
    expect(b[12].text).toBe('الأشجار تستخدم في قواعد البيانات والملفات.');
  });

  it('does not take a following question or bullet as an answer', () => {
    const q = structureText('ما هو المكدس؟\nما هو الطابور؟\n- نقطة');
    expect(q.map((x) => [x.type, x.extra ?? null])).toEqual([['qa', ''], ['qa', ''], ['point', null]]);
  });

  it('caps huge input', () => {
    expect(structureText(Array.from({ length: 900 }, (_, i) => `- نقطة ${i}`).join('\n'))).toHaveLength(400);
  });
});

describe('cards, text and stats', () => {
  const blocks = [block('heading', 'الأشجار'), block('term', 'الجذر', 'أول عقدة'), block('qa', 'ما الورقة؟', 'عقدة بلا أبناء'), block('qa', 'بلا جواب؟'), block('term', 'الجذر', 'مكرر'), block('check', 'مراجعة')];

  it('makes review cards from answered terms and questions only, without duplicates', () => {
    expect(toCards(blocks)).toEqual([
      { front: 'ما المقصود بـ«الجذر»؟', back: 'أول عقدة' },
      { front: 'ما الورقة؟', back: 'عقدة بلا أبناء' },
    ]);
  });

  it('exports readable text', () => {
    const t = toText({ title: 'ملخص الأشجار', blocks }, 'هياكل البيانات');
    expect(t).toContain('📘 ملخص الأشجار\nالمادة: هياكل البيانات');
    expect(t).toContain('▌ الأشجار');
    expect(t).toContain('🔹 الجذر: أول عقدة');
    expect(t).toContain('❓ ما الورقة؟\n   ↳ عقدة بلا أبناء');
    expect(t).toContain('☐ مراجعة');
  });

  it('counts words, reading time and cards', () => {
    expect(summaryStats(blocks)).toMatchObject({ cards: 2, checks: 1, checked: 0, readMin: 1 });
    expect(summaryStats(blocks).words).toBe(14);
  });

  it('ships templates that start with useful blocks', () => {
    for (const t of TEMPLATES) expect(t.make().length).toBeGreaterThan(0);
    expect(TEMPLATES.find((t) => t.id === 'cornell')!.make().filter((x) => x.type === 'heading').map((x) => x.text)).toEqual(['أسئلة وكلمات مفتاحية', 'الملاحظات', 'الخلاصة']);
  });

  it('sanitizes summaries from untrusted backups', () => {
    const s = sanitizeSummaries([{ id: 'a', title: 'x', courseId: 5, blocks: [{ id: 'b', type: 'hack', text: 'x' }, { type: 'check', text: 1 }] }, null, 'bad']);
    expect(s).toHaveLength(1);
    expect(s[0].courseId).toBeNull();
    expect(s[0].blocks).toHaveLength(1);
    expect(s[0].blocks[0]).toMatchObject({ type: 'check', text: '1', done: false });
    expect(sanitizeSummaries('nope')).toEqual([]);
  });
});
