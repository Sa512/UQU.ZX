/**
 * استيراد قائمة طلاب الشعبة من نص منسوخ (Excel / بلاك بورد / النظام الأكاديمي) أو ملف CSV.
 * يتعرف على الأعمدة من العناوين إن وُجدت، وإلا من محتوى الخلايا (البريد يحوي @، الرقم الجامعي أرقام).
 */
import { latinDigits, parseTable } from './csv';

export type RosterRow = { name: string; uniId: string; email: string; phone: string };

const HEAD = {
  name: /^(الاسم|اسم الطالب|اسم الطالبة|الاسم الكامل|name|student name|full name)$/i,
  uniId: /^(الرقم الجامعي|رقم الطالب|الرقم|id|student id|university id|student number)$/i,
  email: /^(البريد|البريد الإلكتروني|الايميل|الإيميل|email|e-mail)$/i,
  phone: /^(الجوال|رقم الجوال|الهاتف|phone|mobile)$/i,
};

const isEmail = (s: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
const isUniId = (s: string) => /^\d{6,12}$/.test(latinDigits(s));
const isPhone = (s: string) => /^(\+?966|0)?5\d{8}$/.test(latinDigits(s).replace(/[\s-]/g, ''));
const isName = (s: string) => /[\p{L}]{2,}/u.test(s) && !isEmail(s);

export function parseRoster(text: string): RosterRow[] {
  const rows = parseTable(text);
  if (!rows.length) return [];
  const header = rows[0].map((c) => c.trim());
  const col: Partial<Record<keyof RosterRow, number>> = {};
  header.forEach((h, i) => {
    (Object.keys(HEAD) as (keyof RosterRow)[]).forEach((k) => {
      if (col[k] === undefined && HEAD[k].test(h)) col[k] = i;
    });
  });
  const hasHeader = Object.keys(col).length > 0;
  const body = hasHeader ? rows.slice(1) : rows;
  const out: RosterRow[] = [];
  const seen = new Set<string>();
  for (const r of body) {
    let name = '';
    let uniId = '';
    let email = '';
    let phone = '';
    if (hasHeader) {
      name = r[col.name ?? -1] ?? '';
      uniId = latinDigits(r[col.uniId ?? -1] ?? '');
      email = r[col.email ?? -1] ?? '';
      phone = latinDigits(r[col.phone ?? -1] ?? '');
    }
    // تعرّف على ما تبقى من محتوى الخلايا
    for (const c of r) {
      const v = c.trim();
      if (!v) continue;
      if (!email && isEmail(v)) email = v;
      else if (!uniId && isUniId(v)) uniId = latinDigits(v);
      else if (!phone && isPhone(v)) phone = latinDigits(v);
      else if (!name && isName(v) && !/^\d+$/.test(latinDigits(v))) name = v;
    }
    name = name.replace(/\s+/g, ' ').trim();
    email = email.toLowerCase();
    if (!name && !uniId) continue;
    const key = uniId || email || name;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ name: name || uniId, uniId, email, phone });
  }
  return out;
}
