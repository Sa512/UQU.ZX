/** رسائل عربية لأخطاء الخادم (تُرفع بنفس الأسماء من دوال Supabase). */
const MESSAGES: Record<string, string> = {
  not_signed_in: 'تعذّر الاتصال بالخادم. تحقق من الإنترنت وحاول مجدداً.',
  page_not_found: 'الرمز غير صحيح. تأكد منه مع الدكتور.',
  page_closed: 'الدكتور أوقف الحجز مؤقتاً.',
  slot_in_past: 'هذا الموعد فات.',
  slot_too_far: 'الحجز متاح لثلاثة أسابيع قادمة فقط.',
  slot_invalid: 'هذا الموعد ليس ضمن الساعات المكتبية.',
  slot_taken: 'سبقك أحد لهذا الموعد — اختر موعداً آخر.',
  too_many_bookings: 'لديك حجزان قادمان مع هذا الدكتور. ألغِ أحدهما لتحجز جديداً.',
  not_allowed: 'لا تملك صلاحية هذا الإجراء.',
  session_not_found: 'رمز التحضير غير صحيح.',
  session_closed: 'انتهى التحضير لهذه المحاضرة.',
  qr_expired: 'انتهت صلاحية الرمز. امسح الرمز الظاهر الآن على الشاشة.',
  already_checked_in: 'حضّرت من هذا الجوال مسبقاً ✓',
  uni_id_used: 'هذا الرقم الجامعي حُضّر به مسبقاً.',
  network: 'لا يوجد اتصال بالإنترنت.',
};

export class CloudError extends Error {
  constructor(public code: string) {
    super(MESSAGES[code] ?? 'حدث خطأ غير متوقع. حاول مجدداً.');
  }
}

export function toCloudError(e: unknown): CloudError {
  if (e instanceof CloudError) return e;
  const msg = String((e as { message?: string })?.message ?? e ?? '');
  const code = Object.keys(MESSAGES).find((k) => msg.includes(k));
  if (code) return new CloudError(code);
  if (/network|fetch|Failed to fetch|timeout/i.test(msg)) return new CloudError('network');
  return new CloudError('unknown');
}
