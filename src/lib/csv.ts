/**
 * قراءة وكتابة الجداول النصية: CSV أو نص منسوخ من Excel/المتصفح (مفصول بـ Tab).
 */

/** يقسم النص إلى صفوف وأعمدة؛ يكتشف الفاصل تلقائياً (Tab ثم ; ثم ,) ويدعم الحقول بين علامتي تنصيص. */
export function parseTable(text: string): string[][] {
  const clean = text.replace(/^﻿/, '').replace(/\r\n?/g, '\n').trim();
  if (!clean) return [];
  const first = clean.split('\n')[0];
  const sep = first.includes('\t') ? '\t' : first.includes(';') && !first.includes(',') ? ';' : first.includes(',') ? ',' : '\t';
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < clean.length; i++) {
    const ch = clean[i];
    if (quoted) {
      if (ch === '"' && clean[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"' && cell === '') quoted = true;
    else if (ch === sep) {
      row.push(cell.trim());
      cell = '';
    } else if (ch === '\n') {
      row.push(cell.trim());
      rows.push(row);
      row = [];
      cell = '';
    } else cell += ch;
  }
  row.push(cell.trim());
  rows.push(row);
  return rows.filter((r) => r.some((c) => c !== ''));
}

const esc = (v: string | number) => {
  const s = String(v ?? '');
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

/** CSV يفتح في Excel بالعربية بشكل صحيح (UTF‑8 مع BOM). */
export function toCsv(rows: (string | number)[][]): string {
  return '﻿' + rows.map((r) => r.map(esc).join(',')).join('\r\n');
}

/** يحوّل الأرقام العربية (٠١٢…) إلى إنجليزية. */
export const latinDigits = (s: string) => s.replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d))).replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)));
