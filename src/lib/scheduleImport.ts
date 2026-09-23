/**
 * استيراد الجدول من نص منسوخ من بوابة الجامعة أو Excel.
 * يدعم: أسماء الأيام أو اختصاراتها (ح ن ث ر خ)، عدة أيام في خلية واحدة،
 * الوقت كنطاق «08:00 - 09:40» أو في عمودين، وصيغ ص/م و24 ساعة.
 */
import type { SlotType } from '@/store/useStore';
import { latinDigits, parseTable } from './csv';

export type ImportedSlot = {
  course: string; // الرمز أو الاسم كما ورد
  courseName: string;
  section: string;
  day: number; // 0 = الأحد
  start: number;
  end: number;
  room: string;
  type: SlotType;
};

const DAY_WORDS: [RegExp, number][] = [
  [/^(الأحد|الاحد|أحد|احد|sun|sunday|ح|u)$/i, 0],
  [/^(الإثنين|الاثنين|إثنين|اثنين|mon|monday|ن|m)$/i, 1],
  [/^(الثلاثاء|ثلاثاء|tue|tuesday|ث|t)$/i, 2],
  [/^(الأربعاء|الاربعاء|أربعاء|اربعاء|wed|wednesday|ر|w)$/i, 3],
  [/^(الخميس|خميس|thu|thursday|خ|r)$/i, 4],
  [/^(الجمعة|جمعة|fri|friday|ج|f)$/i, 5],
  [/^(السبت|سبت|sat|saturday|س|s)$/i, 6],
];

export function parseDays(cell: string): number[] {
  const v = latinDigits(cell).trim();
  if (!v) return [];
  const tokens = v.split(/[\s,،/\-|+]+/).filter(Boolean);
  const out: number[] = [];
  for (const t of tokens) {
    // أرقام الأيام كما في بعض الأنظمة: 1 = الأحد … 7 = السبت
    if (/^[1-7]$/.test(t)) {
      out.push(Number(t) - 1);
      continue;
    }
    const hit = DAY_WORDS.find(([re]) => re.test(t));
    if (hit) out.push(hit[1]);
    else if (/^[حنثرخ]+$/.test(t)) {
      // «حثخ» ملتصقة
      for (const ch of t) {
        const h = DAY_WORDS.find(([re]) => re.test(ch));
        if (h) out.push(h[1]);
      }
    }
  }
  return [...new Set(out)];
}

/** يقرأ وقتاً واحداً إلى دقائق. hintPm: إن كان الوقت صغيراً (١–٦) بلا علامة فهو غالباً مساءً. */
export function parseTime(raw: string): number | null {
  const v = latinDigits(raw).trim().toLowerCase();
  const m = /(\d{1,2})(?::|\.)?(\d{2})?\s*(ص|م|am|pm|a\.m\.|p\.m\.)?/.exec(v);
  if (!m) return null;
  let h = Number(m[1]);
  const min = Number(m[2] ?? 0);
  const suf = m[3];
  if (h > 23 || min > 59) return null;
  if (suf && /^(م|pm|p\.m\.)$/.test(suf) && h < 12) h += 12;
  if (suf && /^(ص|am|a\.m\.)$/.test(suf) && h === 12) h = 0;
  // بدون علامة: 1–6 تعني بعد الظهر في الجدول الجامعي
  if (!suf && h >= 1 && h <= 6) h += 12;
  return h * 60 + min;
}

export function parseRange(cell: string): [number, number] | null {
  const parts = latinDigits(cell).split(/\s*(?:-|–|—|إلى|الى|to)\s*/i).filter(Boolean);
  if (parts.length < 2) return null;
  const a = parseTime(parts[0]);
  const b = parseTime(parts[1]);
  if (a === null || b === null) return null;
  return b > a ? [a, b] : [a, b + 12 * 60 <= 24 * 60 ? b + 12 * 60 : b];
}

const H = {
  code: /(رمز|كود|code|course code|المقرر رقم)/i,
  name: /(اسم المقرر|المقرر|المادة|course( name)?|title)/i,
  section: /(الشعبة|شعبة|section|sec|crn)/i,
  days: /(اليوم|الأيام|الايام|day|days)/i,
  time: /(الوقت|الموعد|time)/i,
  start: /(من|البداية|start|begin)/i,
  end: /(إلى|الى|النهاية|end|finish)/i,
  room: /(القاعة|المكان|المبنى|room|location|building)/i,
  type: /(النوع|نوع|type|activity)/i,
};

function typeOf(s: string): SlotType {
  if (/(مكتب|office)/i.test(s)) return 'office';
  if (/(معمل|عملي|lab)/i.test(s)) return 'lab';
  return 'lecture';
}

export type ScheduleParse = { slots: ImportedSlot[]; skipped: number };

export function parseSchedule(text: string): ScheduleParse {
  const rows = parseTable(text);
  if (!rows.length) return { slots: [], skipped: 0 };
  const header = rows[0];
  const col: Partial<Record<keyof typeof H, number>> = {};
  // الأكثر تحديداً أولاً حتى لا يلتقط «المقرر» عمود «رمز المقرر»
  (['code', 'section', 'days', 'time', 'room', 'type', 'start', 'end', 'name'] as (keyof typeof H)[]).forEach((k) => {
    const i = header.findIndex((h, idx) => H[k].test(h) && !Object.values(col).includes(idx));
    if (i >= 0) col[k] = i;
  });
  const hasHeader = col.days !== undefined && (col.time !== undefined || col.start !== undefined);
  const body = hasHeader ? rows.slice(1) : rows;
  const slots: ImportedSlot[] = [];
  let skipped = 0;
  for (const r of body) {
    const get = (k: keyof typeof H) => (col[k] !== undefined ? (r[col[k]!] ?? '') : '');
    let days: number[] = [];
    let range: [number, number] | null = null;
    let code = '';
    let name = '';
    if (hasHeader) {
      days = parseDays(get('days'));
      range = get('time') ? parseRange(get('time')) : null;
      if (!range && get('start') && get('end')) {
        const a = parseTime(get('start'));
        const b = parseTime(get('end'));
        if (a !== null && b !== null && b > a) range = [a, b];
      }
      code = get('code');
      name = get('name');
    } else {
      // بلا عناوين: نبحث في الخلايا عن الأيام والوقت، وأول نص آخر هو المقرر
      for (const c of r) {
        if (!days.length && parseDays(c).length && c.length <= 40) days = parseDays(c);
        else if (!range && parseRange(c)) range = parseRange(c);
        else if (!code && c && !/^\d+$/.test(c)) code = c;
      }
    }
    // بلا عمود للنوع نستدل من الصف كاملاً (مثلاً «ساعات مكتبية» في خانة القاعة)
    const type = typeOf(col.type !== undefined ? `${get('type')} ${name}` : r.join(' '));
    // الساعات المكتبية لا تحتاج مقرراً
    if (!days.length || !range || (!(code || name) && type !== 'office')) {
      skipped++;
      continue;
    }
    for (const day of days) {
      slots.push({
        course: (code || name).trim(),
        courseName: (name || code).trim(),
        section: get('section').trim(),
        day,
        start: range[0],
        end: range[1],
        room: get('room').trim(),
        type,
      });
    }
  }
  return { slots, skipped };
}
