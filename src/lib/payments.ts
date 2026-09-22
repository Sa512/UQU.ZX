/**
 * وسائل الدفع في «مذاكر».
 *
 * الواجهة مفصولة عن بوابة الدفع (PaymentGateway) حتى يمكن ربطها لاحقاً بـ:
 *  - Apple In-App Purchase / Google Play Billing (إلزامي للاشتراكات الرقمية داخل المتاجر)
 *  - Moyasar / HyperPay / Tap لنسخة الويب (مع خادم للتحقق من العملية)
 * الوضع الحالي: بوابة تجريبية (Sandbox) لا تخصم أي مبالغ حقيقية.
 */
import { Platform } from 'react-native';

export type PaymentMethod = 'applepay' | 'googlepay' | 'mada' | 'card' | 'stcpay';
export type CardBrand = 'mada' | 'visa' | 'mastercard' | 'amex' | 'unknown';

export type PlanId = 'monthly' | 'term' | 'yearly';
export type Plan = {
  id: PlanId;
  title: string;
  price: number; // ريال سعودي شامل الضريبة
  months: number;
  note?: string;
  badge?: string;
};

export const PLANS: Plan[] = [
  { id: 'monthly', title: 'شهري', price: 14.99, months: 1 },
  { id: 'term', title: 'فصلي · 6 أشهر', price: 59.99, months: 6, badge: 'الأنسب للفصل', note: 'يعادل 10 ر.س شهرياً · وفّر 33%' },
  { id: 'yearly', title: 'سنوي', price: 99.99, months: 12, badge: 'وفّر 44%', note: 'يعادل 8.33 ر.س شهرياً' },
];

export const VAT_RATE = 0.15;
/** تفكيك السعر الشامل إلى أساس وضريبة قيمة مضافة ١٥٪. */
export function vatBreakdown(total: number) {
  const base = Math.round((total / (1 + VAT_RATE)) * 100) / 100;
  return { base, vat: Math.round((total - base) * 100) / 100, total };
}

export const METHOD_INFO: Record<PaymentMethod, { title: string; subtitle: string }> = {
  applepay: { title: 'Apple Pay', subtitle: 'ادفع ببصمة الوجه أو الإصبع' },
  googlepay: { title: 'Google Pay', subtitle: 'ادفع بحسابك في Google' },
  mada: { title: 'مدى', subtitle: 'بطاقات مدى البنكية' },
  card: { title: 'بطاقة ائتمانية', subtitle: 'Visa · Mastercard · Amex' },
  stcpay: { title: 'STC Pay', subtitle: 'برقم جوالك ورمز التحقق' },
};

/** وسائل الدفع المتاحة حسب المنصة: Apple Pay على iOS فقط وGoogle Pay على Android فقط. */
export function availableMethods(os: string = Platform.OS): PaymentMethod[] {
  const wallet: PaymentMethod[] = os === 'ios' ? ['applepay'] : os === 'android' ? ['googlepay'] : [];
  return [...wallet, 'mada', 'card', 'stcpay'];
}

// أشهر بادئات بطاقات مدى (BIN) — تُقدَّم على Visa/Mastercard لأن مدى قد تحمل شعاراً مشتركاً.
const MADA_BINS = new Set([
  '588845', '440647', '440795', '446404', '457865', '968208', '457997', '474491', '636120',
  '417633', '468540', '468541', '468542', '468543', '968201', '446393', '588847', '400861',
  '409201', '458456', '484783', '968205', '462220', '455708', '410621', '455036', '968203',
  '486094', '486095', '486096', '504300', '440533', '489317', '489318', '489319', '445564',
  '968211', '401757', '410685', '432328', '428671', '428672', '428673', '968206', '446672',
  '543357', '434107', '431361', '604906', '521076', '588850', '968202', '535825', '529415',
  '543085', '524130', '554180', '549760', '588848', '968209', '531095', '530906', '532013',
  '968204', '422817', '422818', '422819', '428331', '483010', '483011', '483012', '589206',
  '968207', '419593', '439954', '407197', '407395', '520058', '530060', '531196', '412565',
]);

export const digitsOnly = (s: string) => s.replace(/\D/g, '');

export function detectBrand(input: string): CardBrand {
  const n = digitsOnly(input);
  if (n.length >= 6 && MADA_BINS.has(n.slice(0, 6))) return 'mada';
  if (/^4/.test(n)) return 'visa';
  if (/^(5[1-5]|2(2[2-9]|[3-6]\d|7[01]|720))/.test(n)) return 'mastercard';
  if (/^3[47]/.test(n)) return 'amex';
  return 'unknown';
}

export function luhnValid(input: string): boolean {
  const n = digitsOnly(input);
  if (n.length < 12 || n.length > 19) return false;
  let sum = 0;
  let dbl = false;
  for (let i = n.length - 1; i >= 0; i--) {
    let d = n.charCodeAt(i) - 48;
    if (dbl) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
    dbl = !dbl;
  }
  return sum % 10 === 0;
}

/** تنسيق الرقم في مجموعات من ٤ (أو ٤-٦-٥ لأمريكان إكسبريس). */
export function formatCardNumber(input: string): string {
  const n = digitsOnly(input).slice(0, 19);
  if (detectBrand(n) === 'amex') {
    return [n.slice(0, 4), n.slice(4, 10), n.slice(10, 15)].filter(Boolean).join(' ');
  }
  return n.replace(/(\d{4})(?=\d)/g, '$1 ');
}

/** يقبل «MM/YY» ويعيد التنسيق أثناء الكتابة. */
export function formatExpiry(input: string): string {
  const n = digitsOnly(input).slice(0, 4);
  return n.length > 2 ? `${n.slice(0, 2)}/${n.slice(2)}` : n;
}

export function expiryValid(input: string, now = new Date()): boolean {
  const m = /^(\d{2})\/(\d{2})$/.exec(input);
  if (!m) return false;
  const month = Number(m[1]);
  const year = 2000 + Number(m[2]);
  if (month < 1 || month > 12) return false;
  // البطاقة صالحة حتى نهاية شهر الانتهاء
  return new Date(year, month, 1) > now;
}

export function cvvValid(cvv: string, brand: CardBrand): boolean {
  return brand === 'amex' ? /^\d{4}$/.test(cvv) : /^\d{3}$/.test(cvv);
}

/** رقم جوال سعودي: 05xxxxxxxx أو +9665xxxxxxxx أو 9665xxxxxxxx. يعيد الصيغة الموحدة 05xxxxxxxx. */
export function normalizeSaudiMobile(input: string): string | null {
  let n = digitsOnly(input);
  if (n.startsWith('966')) n = '0' + n.slice(3);
  else if (n.startsWith('5') && n.length === 9) n = '0' + n;
  return /^05\d{8}$/.test(n) ? n : null;
}

export type CardDetails = { name: string; number: string; expiry: string; cvv: string };

export type CardErrors = Partial<Record<keyof CardDetails, string>>;

export function validateCard(c: CardDetails, method: 'mada' | 'card', now = new Date()): CardErrors {
  const e: CardErrors = {};
  const brand = detectBrand(c.number);
  if (c.name.trim().length < 3) e.name = 'اكتب الاسم كما هو على البطاقة';
  if (!luhnValid(c.number)) e.number = 'رقم البطاقة غير صحيح';
  else if (method === 'mada' && brand !== 'mada') e.number = 'هذه ليست بطاقة مدى — اختر «بطاقة ائتمانية»';
  if (!expiryValid(c.expiry, now)) e.expiry = 'تاريخ الانتهاء غير صالح';
  if (!cvvValid(c.cvv, brand)) e.cvv = brand === 'amex' ? '4 أرقام' : '3 أرقام';
  return e;
}

export type PaymentRequest = {
  plan: Plan;
  method: PaymentMethod;
  card?: CardDetails;
  mobile?: string;
  otp?: string;
};

export type PaymentResult =
  | { ok: true; reference: string; last4?: string }
  | { ok: false; message: string };

export interface PaymentGateway {
  readonly name: string;
  readonly isSandbox: boolean;
  /** STC Pay: إرسال رمز التحقق للجوال. */
  requestOtp(mobile: string): Promise<{ ok: true } | { ok: false; message: string }>;
  pay(req: PaymentRequest): Promise<PaymentResult>;
}

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** رمز التحقق الثابت في البيئة التجريبية. */
export const SANDBOX_OTP = '123456';
/** بطاقة ترفضها البيئة التجريبية لاختبار مسار الرفض. */
export const SANDBOX_DECLINE_CARD = '4000000000000002';
/** بطاقة مدى تجريبية صالحة (تجتاز فحص Luhn). */
export const SANDBOX_MADA_CARD = '4406470000000007';

export const sandboxGateway: PaymentGateway = {
  name: 'Sandbox',
  isSandbox: true,
  async requestOtp(mobile) {
    await wait(700);
    return normalizeSaudiMobile(mobile) ? { ok: true } : { ok: false, message: 'رقم الجوال غير صحيح' };
  },
  async pay(req) {
    await wait(1200);
    const ref = 'MZ-' + Date.now().toString(36).toUpperCase();
    if (req.method === 'mada' || req.method === 'card') {
      if (!req.card) return { ok: false, message: 'بيانات البطاقة ناقصة' };
      const errors = validateCard(req.card, req.method);
      if (Object.keys(errors).length) return { ok: false, message: 'تحقق من بيانات البطاقة' };
      const n = digitsOnly(req.card.number);
      if (n === SANDBOX_DECLINE_CARD) return { ok: false, message: 'رفض البنك العملية. جرّب بطاقة أخرى.' };
      return { ok: true, reference: ref, last4: n.slice(-4) };
    }
    if (req.method === 'stcpay') {
      if (!req.mobile || !normalizeSaudiMobile(req.mobile)) return { ok: false, message: 'رقم الجوال غير صحيح' };
      if (req.otp !== SANDBOX_OTP) return { ok: false, message: 'رمز التحقق غير صحيح' };
      return { ok: true, reference: ref };
    }
    return { ok: true, reference: ref };
  },
};

export const paymentGateway: PaymentGateway = sandboxGateway;
