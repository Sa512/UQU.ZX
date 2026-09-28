/** رسائل عربية لأخطاء الخادم (تُرفع بنفس الأسماء من دوال Supabase). */
const MESSAGES: Record<string, string> = {
  not_signed_in: 'سجّل دخولك أولاً.',
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
  rate_limited: 'محاولات كثيرة في وقت قصير. انتظر دقيقة ثم حاول مجدداً.',
  section_not_found: 'رمز الشعبة غير صحيح. تأكد منه مع الدكتور.',
  too_many_posts: 'وصلت حد الإعلانات اليومي (20). جرّب غداً.',
  // الحسابات
  not_university_email: 'استخدم إيميلك الجامعي (ينتهي غالباً بـ edu.sa).',
  student_email: 'هذا إيميل طالب. سجّل كطالب، أو استخدم إيميلك الوظيفي في الجامعة.',
  role_locked: 'هذا الحساب محدد بدور معيّن من المشرف.',
  bad_name: 'اكتب اسمك (حرفان على الأقل).',
  bad_role: 'اختر: طالب أو عضو هيئة تدريس.',
  no_profile: 'أكمل ملفك أولاً.',
  not_found: 'غير موجود.',
  invalid_credentials: 'الإيميل أو كلمة المرور غير صحيحة.',
  email_not_confirmed: 'أكّد إيميلك أولاً بالرمز المرسل إليه.',
  bad_code: 'الرمز غير صحيح أو انتهت صلاحيته. اطلب رمزاً جديداً.',
  weak_password: 'كلمة المرور 8 خانات على الأقل.',
  user_exists: 'هذا الإيميل مسجل مسبقاً. سجّل دخولك.',
  email_rate: 'طلبت رموزاً كثيرة. انتظر دقيقة ثم حاول.',
};

/** رسائل Supabase Auth الإنجليزية ← رموزنا. */
const AUTH_PATTERNS: [RegExp, string][] = [
  [/invalid login credentials/i, 'invalid_credentials'],
  [/email not confirmed/i, 'email_not_confirmed'],
  [/token has expired|invalid.*(otp|token)|otp.*(expired|invalid)/i, 'bad_code'],
  [/password should be|weak password/i, 'weak_password'],
  [/already registered|already been registered|user_already_exists/i, 'user_exists'],
  [/rate limit|only request this after|over_email_send_rate_limit/i, 'email_rate'],
];

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
  const auth = AUTH_PATTERNS.find(([re]) => re.test(msg));
  if (auth) return new CloudError(auth[1]);
  if (/network|fetch|Failed to fetch|timeout/i.test(msg)) return new CloudError('network');
  return new CloudError('unknown');
}
