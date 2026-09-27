/**
 * الملخصات: ملخص الطالب مكوّن من «كتل» (عنوان، نقطة، مصطلح، سؤال وجواب، تنبيه مهم، قانون، مهمة مراجعة).
 * دوال نقية: قوالب جاهزة، وتنظيم نص ملصوق تلقائياً، وتحويل المصطلحات والأسئلة إلى بطاقات مراجعة، وتصدير كنص.
 */
import { uid } from './id';

export type BlockType = 'heading' | 'text' | 'point' | 'term' | 'qa' | 'important' | 'formula' | 'check';
/** text: النص أو المصطلح أو السؤال. extra: التعريف أو الجواب. */
export type Block = { id: string; type: BlockType; text: string; extra?: string; done?: boolean };
export type Summary = { id: string; title: string; courseId: string | null; blocks: Block[]; createdAt: number; updatedAt: number; deckId?: string };

export const MAX_BLOCKS = 400;
const MAX_TEXT = 2000;

export const BLOCK_INFO: Record<BlockType, { label: string; icon: string; placeholder: string; extraPlaceholder?: string }> = {
  heading: { label: 'عنوان', icon: 'text', placeholder: 'عنوان القسم' },
  text: { label: 'فقرة', icon: 'reorder-three', placeholder: 'اكتب الفكرة بأسلوبك…' },
  point: { label: 'نقطة', icon: 'ellipse', placeholder: 'نقطة مختصرة' },
  term: { label: 'مصطلح', icon: 'bookmark', placeholder: 'المصطلح', extraPlaceholder: 'التعريف' },
  qa: { label: 'سؤال', icon: 'help-circle', placeholder: 'السؤال', extraPlaceholder: 'الجواب' },
  important: { label: 'مهم', icon: 'alert-circle', placeholder: 'معلومة لازم تنحفظ' },
  formula: { label: 'قانون', icon: 'calculator', placeholder: 'F = m × a' },
  check: { label: 'للمراجعة', icon: 'checkbox', placeholder: 'موضوع أراجعه' },
};
export const BLOCK_ORDER: BlockType[] = ['heading', 'point', 'term', 'qa', 'important', 'formula', 'text', 'check'];

export const block = (type: BlockType, text = '', extra?: string): Block => ({ id: uid(), type, text, ...(type === 'term' || type === 'qa' ? { extra: extra ?? '' } : {}), ...(type === 'check' ? { done: false } : {}) });

export type TemplateId = 'blank' | 'lecture' | 'cornell' | 'terms' | 'exam';
export const TEMPLATES: { id: TemplateId; title: string; hint: string; icon: string; make: () => Block[] }[] = [
  { id: 'lecture', title: 'ملخص محاضرة', hint: 'الفكرة، النقاط، المصطلحات، أسئلة متوقعة', icon: 'easel', make: () => [block('heading', 'الفكرة الرئيسية'), block('text'), block('heading', 'أهم النقاط'), block('point'), block('point'), block('heading', 'المصطلحات'), block('term'), block('heading', 'أسئلة متوقعة'), block('qa')] },
  { id: 'cornell', title: 'طريقة كورنيل', hint: 'أسئلة مفتاحية ← ملاحظات ← خلاصة', icon: 'grid', make: () => [block('heading', 'أسئلة وكلمات مفتاحية'), block('qa'), block('qa'), block('heading', 'الملاحظات'), block('point'), block('point'), block('point'), block('heading', 'الخلاصة'), block('text')] },
  { id: 'terms', title: 'قاموس مصطلحات', hint: 'مصطلح وتعريف، تتحول لبطاقات', icon: 'book', make: () => [block('term'), block('term'), block('term')] },
  { id: 'exam', title: 'مراجعة اختبار', hint: 'المواضيع، القوانين، أسئلة تدريب', icon: 'school', make: () => [block('heading', 'المواضيع المطلوبة'), block('check'), block('check'), block('heading', 'القوانين'), block('formula'), block('heading', 'أسئلة تدريب'), block('qa'), block('qa'), block('important')] },
  { id: 'blank', title: 'فارغ', hint: 'ابدأ من الصفر', icon: 'document', make: () => [block('point')] },
];

const cut = (s: string) => s.trim().slice(0, MAX_TEXT);
const BULLET = /^\s*(?:[-–•*·▪◦]|(?:\d+|[٠-٩]+)[.)\-]|\([\d٠-٩]+\))\s+/;
const QPREFIX = /^\s*(?:س\s*[:/]|سؤال\s*:|q\s*[:.]|question\s*:)\s*/i;
const APREFIX = /^\s*(?:ج\s*[:/]|جواب\s*:|الجواب\s*:|a\s*[:.]|answer\s*:)\s*/i;
const IMPORTANT = /^\s*(?:!+|⚠️|⭐|مهم(?:\s+جداً?|\s+جدا)?|ملاحظة\s+مهمة|تنبيه|انتبه|important|note)\s*[:：\-!]?\s*/i;
const CHECK = /^\s*(?:-\s*)?(?:\[( |x|X)\]|☐|☑|✅)\s*/;
/** سطر قصير فيه «=» أو رموز رياضية (بالعربية أو الإنجليزية): «القوة = الكتلة × التسارع». */
const isFormula = (s: string) => /[=≈≤≥∑√]/.test(s) && s.length <= 120;

/** «المصطلح: التعريف» أو «المصطلح - التعريف»: المصطلح قصير (حتى 6 كلمات) والتعريف موجود. */
function splitTerm(s: string): [string, string] | null {
  const m = /^(.{1,50}?)\s*(?::|：| - | – | — )\s*(.+)$/.exec(s);
  if (!m) return null;
  const [, term, def] = m;
  if (term.trim().split(/\s+/).length > 6 || /[؟?]$/.test(term.trim())) return null;
  return [term.trim(), def.trim()];
}

/**
 * يحوّل نصاً ملصوقاً (من ملاحظات المحاضرة أو الواتساب أو ملف) إلى ملخص منظّم:
 * «# عنوان» أو سطر قصير ينتهي بنقطتين ← عنوان · «-» أو ترقيم ← نقطة · «مصطلح: تعريف» ← مصطلح
 * «س:/ج:» أو سطر ينتهي بـ«؟» يليه جوابه ← سؤال وجواب · «مهم:» ← تنبيه · سطر فيه «=» بلا عربية ← قانون · «[ ]» ← مهمة مراجعة.
 */
export function structureText(raw: string): Block[] {
  const lines = raw.replace(/\r\n?/g, '\n').split('\n').map((l) => l.trim()).filter(Boolean);
  const out: Block[] = [];
  for (let i = 0; i < lines.length && out.length < MAX_BLOCKS; i++) {
    const line = lines[i];
    const next = lines[i + 1];
    let m: RegExpExecArray | null;
    if (/^#{1,6}\s*/.test(line)) {
      out.push(block('heading', cut(line.replace(/^#{1,6}\s*/, ''))));
      continue;
    }
    if ((m = CHECK.exec(line))) {
      const b = block('check', cut(line.slice(m[0].length)));
      b.done = /x|☑|✅/i.test(m[0]);
      out.push(b);
      continue;
    }
    if (QPREFIX.test(line) || /[؟?]$/.test(line.replace(BULLET, ''))) {
      const q = cut(line.replace(QPREFIX, '').replace(BULLET, ''));
      let a = '';
      if (next && (APREFIX.test(next) || (!QPREFIX.test(next) && !/[؟?]$/.test(next) && !/^#/.test(next) && !BULLET.test(next) && !IMPORTANT.test(next) && !/[:：]$/.test(next)))) {
        a = cut(next.replace(APREFIX, ''));
        i++;
      }
      out.push(block('qa', q, a));
      continue;
    }
    if (IMPORTANT.test(line) && line.replace(IMPORTANT, '').length > 0 && !/^important$/i.test(line)) {
      out.push(block('important', cut(line.replace(IMPORTANT, ''))));
      continue;
    }
    if (/[:：]$/.test(line) && line.length <= 60 && !BULLET.test(line)) {
      out.push(block('heading', cut(line.replace(/[:：]$/, ''))));
      continue;
    }
    const bullet = BULLET.test(line);
    const body = line.replace(BULLET, '');
    if (isFormula(body)) {
      out.push(block('formula', cut(body)));
      continue;
    }
    const t = splitTerm(body);
    if (t) {
      out.push(block('term', cut(t[0]), cut(t[1])));
      continue;
    }
    out.push(block(bullet ? 'point' : 'text', cut(body)));
  }
  return out;
}

export type CardDraft = { front: string; back: string };

/** البطاقات من المصطلحات (المصطلح ← التعريف) والأسئلة المُجابة، دون تكرار. */
export function toCards(blocks: Block[]): CardDraft[] {
  const seen = new Set<string>();
  const out: CardDraft[] = [];
  for (const b of blocks) {
    if ((b.type !== 'term' && b.type !== 'qa') || !b.text.trim() || !b.extra?.trim()) continue;
    const front = b.type === 'term' ? `ما المقصود بـ«${b.text.trim()}»؟` : b.text.trim();
    if (seen.has(front)) continue;
    seen.add(front);
    out.push({ front, back: b.extra.trim() });
  }
  return out;
}

/** نص منسّق للمشاركة (واتساب، ملاحظات، بريد). */
export function toText(s: Pick<Summary, 'title' | 'blocks'>, courseName?: string): string {
  const lines = [`📘 ${s.title}`];
  if (courseName) lines.push(`المادة: ${courseName}`);
  for (const b of s.blocks) {
    const t = b.text.trim();
    if (!t && !b.extra?.trim()) continue;
    switch (b.type) {
      case 'heading': lines.push('', `▌ ${t}`); break;
      case 'text': lines.push(t); break;
      case 'point': lines.push(`• ${t}`); break;
      case 'term': lines.push(`🔹 ${t}: ${b.extra?.trim() ?? ''}`); break;
      case 'qa': lines.push(`❓ ${t}`, ...(b.extra?.trim() ? [`   ↳ ${b.extra.trim()}`] : [])); break;
      case 'important': lines.push(`⚠️ ${t}`); break;
      case 'formula': lines.push(`🧮 ${t}`); break;
      case 'check': lines.push(`${b.done ? '☑' : '☐'} ${t}`); break;
    }
  }
  lines.push('', '— لُخّص بتطبيق مذاكر');
  return lines.join('\n');
}

/** إحصاءات الملخص: الكلمات، ودقائق القراءة التقريبية (180 كلمة/دقيقة)، وعدد البطاقات الممكنة. */
export function summaryStats(blocks: Block[]) {
  const words = blocks.reduce((n, b) => n + `${b.text} ${b.extra ?? ''}`.split(/\s+/).filter(Boolean).length, 0);
  const checks = blocks.filter((b) => b.type === 'check');
  return { words, readMin: Math.max(1, Math.round(words / 180)), cards: toCards(blocks).length, checks: checks.length, checked: checks.filter((b) => b.done).length };
}

/** ينظّف ملخصاً قادماً من نسخة احتياطية (بنية غير موثوقة). */
export function sanitizeSummaries(x: unknown): Summary[] {
  if (!Array.isArray(x)) return [];
  const types = new Set(Object.keys(BLOCK_INFO));
  return x
    .filter((s): s is Summary => !!s && typeof s === 'object' && typeof (s as Summary).id === 'string' && Array.isArray((s as Summary).blocks))
    .map((s) => ({
      id: s.id,
      title: String(s.title ?? '').slice(0, 200) || 'ملخص',
      courseId: typeof s.courseId === 'string' ? s.courseId : null,
      createdAt: Number(s.createdAt) || Date.now(),
      updatedAt: Number(s.updatedAt) || Date.now(),
      ...(typeof s.deckId === 'string' ? { deckId: s.deckId } : {}),
      blocks: s.blocks
        .filter((b) => b && types.has(b.type))
        .slice(0, MAX_BLOCKS)
        .map((b) => ({ id: String(b.id ?? uid()), type: b.type, text: String(b.text ?? '').slice(0, MAX_TEXT), ...(b.extra !== undefined ? { extra: String(b.extra).slice(0, MAX_TEXT) } : {}), ...(b.type === 'check' ? { done: !!b.done } : {}) })),
    }));
}
