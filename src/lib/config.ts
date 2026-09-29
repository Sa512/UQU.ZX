/**
 * الدخول إجباري من أول فتح (افتراضياً). إن رفضت Apple ذلك (الإرشاد 5.1.1) يُبنى التطبيق بـ
 * EXPO_PUBLIC_REQUIRE_LOGIN=false فيعمل الجدول والمهام والملخصات بلا حساب، ويُطلب الحساب
 * عند الحجز والتحضير والقنوات فقط — دون أي تغيير في الكود.
 */
export const REQUIRE_LOGIN = process.env.EXPO_PUBLIC_REQUIRE_LOGIN !== 'false';
