/**
 * التاريخ الهجري بتقويم أم القرى (الرسمي في السعودية) عبر Intl.
 * إن لم يدعم محرك الجهاز هذا التقويم نعيد null ولا نعرض تاريخاً قد يكون خاطئاً.
 */
let formatter: Intl.DateTimeFormat | null | undefined;

function getFormatter(): Intl.DateTimeFormat | null {
  if (formatter !== undefined) return formatter;
  try {
    const f = new Intl.DateTimeFormat('ar-SA-u-ca-islamic-umalqura-nu-latn', { day: 'numeric', month: 'long', year: 'numeric' });
    formatter = f.resolvedOptions().calendar === 'islamic-umalqura' ? f : null;
  } catch {
    formatter = null;
  }
  return formatter;
}

export function formatHijri(d: Date): string | null {
  const f = getFormatter();
  if (!f) return null;
  const s = f.format(d).replace(/‏/g, '').trim();
  return s.includes('هـ') ? s : `${s} هـ`;
}
