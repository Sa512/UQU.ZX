import { MAX_ICS_BYTES, parseIcs, type IcsEvent } from './ical';

/** يجلب تقويم الطالب من جواله مباشرة (مهلة 15 ثانية، وحد للحجم). */
export async function fetchIcs(url: string): Promise<IcsEvent[]> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 15_000);
  try {
    const res = await fetch(url, { signal: ctrl.signal, headers: { Accept: 'text/calendar, text/plain;q=0.9' } });
    if (!res.ok) throw new Error(res.status === 404 || res.status === 403 ? 'feed_gone' : 'feed_failed');
    const len = Number(res.headers.get('content-length') ?? 0);
    if (len > MAX_ICS_BYTES) throw new Error('ics_too_large');
    const text = await res.text();
    if (!/BEGIN:VCALENDAR/i.test(text)) throw new Error('not_ics');
    return parseIcs(text);
  } catch (e) {
    const m = (e as Error).message;
    if (m === 'feed_gone') throw new Error('الرابط لم يعد يعمل. انسخ رابطاً جديداً من تقويم Blackboard.');
    if (m === 'ics_too_large') throw new Error('ملف التقويم كبير جداً.');
    if (m === 'not_ics') throw new Error('هذا الرابط ليس رابط تقويم. تأكد أنك نسخت رابط «مشاركة التقويم».');
    throw new Error('تعذّر جلب التقويم. تحقق من الاتصال أو من الرابط.');
  } finally {
    clearTimeout(timer);
  }
}
