# دليل الإطلاق — ما تبقى عليك فقط ✅

> الخطة الزمنية الكاملة لإطلاق نوفمبر والتكاليف والامتثال: `reports/launch-plan-november.md`

كل الكود والصفحات والصور والنصوص جاهزة. هذه خطوات إدارية لا يمكن عملها إلا بحساباتك.
الوقت المتوقع: **يوم واحد** + مدة مراجعة المتاجر (عادة 1–3 أيام).

---

## 1) تفعيل موقع الخصوصية والدعم (دقيقتان)

GitHub ← مستودع **UQU.ZX** ← Settings ← Pages
- Source: **Deploy from a branch**
- Branch: `main` (بعد دمج الفرع) أو `claude/compassionate-lamport-xorm9c` — المجلد: **/docs** ← Save

بعد دقيقة تعمل الروابط:
- https://sa512.github.io/UQU.ZX/privacy.html
- https://sa512.github.io/UQU.ZX/terms.html

## 2) الحسابات (مرة واحدة)

| الحساب | التكلفة | الرابط |
|---|---|---|
| Expo (للبناء السحابي) | مجاني | https://expo.dev/signup |
| Apple Developer | 99$ سنوياً | https://developer.apple.com/programs/enroll |
| Google Play Console | 25$ مرة واحدة | https://play.google.com/console/signup |
| RevenueCat (للاشتراكات) | مجاني حتى 2,500$ إيرادات شهرية | https://app.revenuecat.com/signup |

> لاستلام الأرباح: أكمل في المتجرين «الاتفاقيات والضرائب والبنوك» بسجل تجاري أو وثيقة العمل الحر وحساب بنكي.

## 3) ربط المشروع بـ Expo (3 أوامر)

```bash
npm install
npx eas-cli@latest login
npx eas-cli@latest init        # يضيف معرّف المشروع تلقائياً
```

## 4) إنشاء التطبيق والاشتراكات في المتجرين

انسخ كل الحقول من [`store/listing.md`](store/listing.md):
- **App Store Connect:** تطبيق جديد بمعرّف `sa.mudhaker.app` ← Subscriptions ← مجموعة `Mudhaker Pro` بالمنتجات الثلاثة.
- **Google Play Console:** تطبيق جديد ← Monetize ← Subscriptions بنفس المعرّفات.

## 5) RevenueCat (10 دقائق)

1. مشروع جديد ← أضف تطبيق iOS وتطبيق Android واربطهما بالمتجرين (يرشدك الموقع خطوة بخطوة).
2. Entitlements ← أنشئ `pro` وأضف له المنتجات الثلاثة.
3. Offerings ← `default` ← الحزم: Monthly و Six Month و Annual.
4. انسخ **Public SDK keys** وضعها في EAS:

```bash
npx eas-cli@latest env:create --name EXPO_PUBLIC_REVENUECAT_IOS_KEY --value "appl_xxx" --environment production --visibility plaintext
npx eas-cli@latest env:create --name EXPO_PUBLIC_REVENUECAT_ANDROID_KEY --value "goog_xxx" --environment production --visibility plaintext
```

بمجرد وجود المفاتيح يتحول التطبيق تلقائياً من الدفع التجريبي إلى الدفع الحقيقي عبر المتجر.

## 5.5) الخادم: حجز الساعات المكتبية والتحضير بالـ QR (15 دقيقة)

بدون هذه الخطوة تعمل الميزتان بوضع تجريبي على جهاز واحد فقط.

1. أنشئ مشروعاً في https://supabase.com (الخطة المجانية تكفي للبداية).
   - **المنطقة:** اختر الأقرب للمملكة. بيانات الطلاب (الاسم والرقم الجامعي) بيانات شخصية؛ راجع مع جامعتك متطلبات نظام حماية البيانات الشخصية لنقلها خارج المملكة.
2. **الدخول بالإيميل الجامعي (من الإصدار 1.6):**
   - Authentication ← Sign In / Providers ← **Email**: فعّل Email و**Confirm email**، وأوقف **Anonymous sign-ins** (لم تعد مستخدمة).
   - Authentication ← Emails ← Templates: في قالبي **Confirm signup** و**Reset password** ضع الرمز بدل الرابط، مثلاً: `رمز تأكيد حسابك في مذاكر: {{ .Token }}` (التطبيق يطلب الرمز المكوّن من 6 أرقام).
   - Authentication ← Emails ← **SMTP Settings**: اربط مزوّد إرسال خاص (مثل Resend أو Amazon SES أو Brevo) باسم نطاقك. مزوّد Supabase الافتراضي محدود جداً ولا يصلح للإطلاق، وبعض إيميلات الجامعات ترفض الرسائل غير الموثّقة.
   - Authentication ← Attack Protection: فعّل **CAPTCHA** وراجع **Rate Limits** للتسجيل وإرسال الرموز.
   - Authentication ← Providers ← Email: اجعل **Minimum password length = 8** (مثل التطبيق)، وفعّل **Secure email change**. الخادم يرفض أي إيميل غير مؤكَّد حتى لو عُطّل التأكيد خطأً.
3. SQL Editor ← الصق محتوى ملفات `supabase/migrations/` بالترتيب (`20260923000000_cloud.sql` ثم `20260925000000_sections.sql` ثم `20260926000000_privacy.sql` ثم `20260927000000_hardening.sql` ثم `20260928000000_push.sql` ثم `20260929000000_accounts.sql` ثم `20260930000000_security.sql` ثم `20261001000000_hardening2.sql` ثم `20261002000000_booking_push.sql` ثم `20261003000000_cancel_notice.sql`) ← Run.
   - الهجرة الأخيرة تجعل `asd1911147@gmail.com` مشرفاً (سجّل به من التطبيق لتظهر لك «لوحة المشرف» في المزيد). لإضافة مشرف آخر: من اللوحة ← استثناءات الإيميل ← مشرف.
4. التنظيف التلقائي: Database ← Extensions ← فعّل `pg_cron`، ثم نفّذ:
   ```sql
   select cron.schedule('mudhaker-cleanup', '0 3 * * *', 'select public.cleanup_old_data()');
   ```
5. Project Settings ← API: انسخ **Project URL** و**anon public key** وضعهما في EAS:
   ```bash
   npx eas-cli@latest env:create --name EXPO_PUBLIC_SUPABASE_URL --value "https://xxxx.supabase.co" --environment production --visibility plaintext
   npx eas-cli@latest env:create --name EXPO_PUBLIC_SUPABASE_ANON_KEY --value "eyJ..." --environment production --visibility plaintext
   ```
   (مفتاح anon عام بطبيعته؛ الحماية في قواعد RLS والدوال المختبرة في `supabase/tests`.)
6. **حساب مراجعة Apple وGoogle:** المراجع لا يملك إيميلاً جامعياً. من لوحة المشرف ← استثناءات الإيميل أضف مثلاً `review@yourdomain.com` كطالب، ثم أنشئ الحساب من Supabase ← Authentication ← Users ← Add user (مع Auto Confirm)، وضع الإيميل وكلمة المرور في «App Review Information» و«App access» في Google Play.
   > ⚠️ Apple (الإرشاد 5.1.1) قد ترفض التطبيق إن طلب تسجيل الدخول لميزات لا تحتاج حساباً (الجدول والمهام والملخصات). إن حصل ذلك فالحل الأسرع: السماح بتصفح التطبيق دون حساب وطلب الدخول عند الحجز والتحضير والقنوات فقط.
7. **إشعارات إعلانات الدكاترة (اختياري لكنه موصى به):**
   ```bash
   npx eas-cli@latest init                       # يضيف projectId إلى app.json (مطلوب لعناوين الإشعارات)
   npx supabase functions deploy notify-section-post --no-verify-jwt
   npx supabase secrets set WEBHOOK_SECRET="اختر-نصاً-عشوائياً-طويلاً"
   ```
   ثم Database ← Webhooks ← Create: الجدول `section_posts`، الحدث **Insert**، النوع **Supabase Edge Function** ← `notify-section-post`، وأضف ترويسة `x-webhook-secret` بنفس القيمة.
   بدون هذه الخطوة تعمل القناة كما هي، ويصل الإعلان عند فتح التطبيق.
   **إشعار الدكتور بالحجز الجديد:** `npx supabase functions deploy notify-booking --no-verify-jwt`، ثم Webhook ثانٍ: الجدول `bookings`، الحدثان **Insert** و**Update** (2.0: الثاني لإشعار الطالب إذا ألغى الدكتور موعده)، الدالة `notify-booking`، بنفس ترويسة `x-webhook-secret`.
8. **خطة بديلة إن رفضت Apple إلزامية التسجيل (5.1.1):** أضف في EAS المتغير `EXPO_PUBLIC_REQUIRE_LOGIN=false` وابنِ من جديد؛ يعمل التطبيق بلا حساب ويُطلب الحساب عند الحجز والتحضير والقنوات فقط:
   ```bash
   npx eas-cli@latest env:create --name EXPO_PUBLIC_REQUIRE_LOGIN --value "false" --environment production --visibility plaintext
   ```

## 6) البناء والتجربة ثم الإرسال

```bash
npx eas-cli@latest build --platform all --profile production
npx eas-cli@latest submit --platform ios       # يرفع إلى TestFlight
npx eas-cli@latest submit --platform android   # يرفع إلى Internal testing
```

جرّب على جوالك من TestFlight / Internal testing بالقائمة التالية، ثم أرسل للمراجعة من لوحتي المتجرين مع الصور في `store/screenshots/`.

### قائمة الاختبار قبل الإرسال

- [ ] التهيئة: اختيار الدور، الاسم، «ابدأ بجدول تجريبي»
- [ ] الاتجاه من اليمين لليسار في كل الشاشات
- [ ] إضافة مقرر وحصة ومهمة وتعديلها وحذفها
- [ ] المؤقت: ابدأ ← إيقاف مؤقت ← إنهاء؛ الجلسة تظهر في «جلسات اليوم»
- [ ] الإعدادات ← تفعيل التذكيرات ← «أرسل تذكيراً تجريبياً» (يصل خلال 5 ثوانٍ)
- [ ] حصة بعد 20 دقيقة ← يصل تذكيرها قبلها بالمدة المختارة
- [ ] مذاكر برو: الأسعار تظهر من المتجر، الشراء بحساب Sandbox، ثم «استعادة المشتريات»
- [ ] الحجز: الدكتور ينشر ساعاته ← طالب من جوال آخر يحجز بالرمز ← يظهر الحجز عند الدكتور
- [ ] التحضير بالـ QR: الدكتور يعرض الرمز ← 3 طلاب يمسحون من جوالاتهم ← الإنهاء يسجّل الحضور والغياب
- [ ] صورة الرمز المرسلة بعد دقيقة تُرفض («انتهت صلاحية الرمز»)
- [ ] الوضع الداكن (من إعدادات الجوال)
- [ ] إغلاق التطبيق وفتحه: البيانات محفوظة
