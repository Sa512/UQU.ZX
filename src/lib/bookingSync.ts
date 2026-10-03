import type { Booking } from './cloud/types';
import type { MyBooking } from '@/store/useStore';

/**
 * مطابقة حجوزات الطالب المحفوظة على الجهاز مع الخادم: إن ألغى الدكتور موعداً يصير ملغى هنا
 * (فيختفي تذكيره) ويُعرض للطالب تنبيه بالسبب. لا يُضاف أي حجز جديد من الخادم (الجهاز يحفظ ما حجزه هو).
 */
export function reconcileBookings(local: MyBooking[], remote: Pick<Booking, 'id' | 'status' | 'cancelled_by' | 'cancel_note'>[]): { next: MyBooking[]; changed: boolean } {
  const byId = new Map(remote.map((r) => [r.id, r]));
  let changed = false;
  const next = local.map((b) => {
    const r = byId.get(b.id);
    if (!r || b.status !== 'booked' || r.status !== 'cancelled') return b;
    changed = true;
    const host = r.cancelled_by === 'host';
    return { ...b, status: 'cancelled' as const, cancelledBy: host ? ('host' as const) : ('student' as const), cancelNote: host ? (r.cancel_note ?? '').trim() : '', noticeSeen: !host };
  });
  return { next, changed };
}

/** مواعيد ألغاها الدكتور ولم يطّلع عليها الطالب بعد (القادمة فقط). */
export function unseenCancellations(list: MyBooking[], now: number): MyBooking[] {
  return list.filter((b) => b.status === 'cancelled' && b.cancelledBy === 'host' && !b.noticeSeen && new Date(b.startsAt).getTime() > now);
}
