# بطاقة تعريف في Apple Wallet

تصنع بطاقة باسمك وتخصصك وجوالك وإيميلك، وفيها رمز QR يمسحه موظف الشركة فتنحفظ بياناتك في جهات اتصاله مباشرة.
ورا البطاقة: نبذة عنك، ومهاراتك، ورابط LinkedIn، ورابط السيرة الذاتية.

## 1) بياناتك
```bash
cp card.example.json card.json
```
عدّل `card.json` واكتب بياناتك. `nameEn` و`titleEn` بالإنجليزي لأنها تروح في رمز QR.
تبي صورتك على البطاقة؟ حط صورة مربعة باسم `photo.png` في نفس المجلد.
الملفان `card.json` و`photo.png` ما ينرفعون على GitHub.

## 2) الشهادات (مرة وحدة بس، من حساب Apple Developer)
1. في [developer.apple.com](https://developer.apple.com/account/resources/identifiers/list/passTypeId) افتح Identifiers، واضغط **+**، واختر **Pass Type IDs**، وسجّل `pass.sa.mudhaker.card`.
2. أنشئ طلب الشهادة:
   ```bash
   mkdir certs
   openssl req -new -newkey rsa:2048 -nodes -keyout certs/pass.key -out certs/pass.csr -subj "/CN=Wallet Card"
   ```
3. في Certificates اضغط **+**، واختر **Pass Type ID Certificate**، واختر المعرّف، وارفع `certs/pass.csr`. بعدها نزّل الشهادة وحطها في `certs/pass.cer`.
4. نزّل [AppleWWDRCAG4.cer](https://www.apple.com/certificateauthority/AppleWWDRCAG4.cer) وحطه في `certs/`.
5. اكتب في `card.json` قيمة `teamIdentifier`، وتلقاها في Membership أعلى صفحة الحساب، وهي 10 حروف.

مجلد `certs/` ما ينرفع على GitHub. لا تشاركه مع أحد.

## 3) اصنع البطاقة
```bash
npm install
npm run make
```
يطلع لك ملف `my-card.pkpass`. أرسله لجوالك بـ AirDrop أو بالإيميل، وافتحه، واضغط **إضافة**.
إذا عدلت بياناتك، شغّل `npm run make` مرة ثانية وأضف البطاقة الجديدة.
