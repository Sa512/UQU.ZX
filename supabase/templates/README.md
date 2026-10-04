# قوالب رسائل رمز التحقق

التطبيق يطلب **رمزاً من 6 أرقام** (لا رابطاً)، فالقالب لازم يحتوي `{{ .Token }}`.

| القالب في Supabase | الملف | العنوان (Subject) |
|---|---|---|
| Authentication ← Emails ← **Confirm signup** | `confirm-signup.html` | `رمز تأكيد حسابك في مذاكر: {{ .Token }}` |
| Authentication ← Emails ← **Reset password** | `reset-password.html` | `رمز استعادة كلمة المرور في مذاكر` |

انسخ محتوى الملف كاملاً في خانة Message body، ثم اضبط في Authentication ← Providers ← Email:
**Email OTP Length = 6** و **Email OTP Expiration = 900** (15 دقيقة، كما في نص الرسالة).

الخطوات الكاملة (SMTP والنطاق والاختبار): `LAUNCH.md` ← «إرسال رمز التحقق».
