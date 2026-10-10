# بطاقة تعريف في Apple Wallet

بطاقة فيها اسمك وتخصصك وجوالك وإيميلك، ورمز QR يمسحه موظف الشركة فتنحفظ بياناتك في جواله.
ورا البطاقة: نبذة عنك، ومهاراتك، ورابط LinkedIn، ورابط سيرتك.

تحتاج **كمبيوتر** (ماك أو ويندوز) مرة وحدة، وحساب Apple Developer.
- على الماك: افتح تطبيق **Terminal**.
- على ويندوز: افتح **Git Bash** لأن فيه أمر `openssl`. وتحتاج **Node.js** مثبت.

---

## الخطوة 1: نزّل المشروع وادخل المجلد
```bash
git clone https://github.com/sa512/UQU.ZX.git
cd UQU.ZX
git checkout claude/tender-carson-yfkbnm
cd tools/wallet-card
npm install
```

## الخطوة 2: اكتب بياناتك
```bash
cp card.example.json card.json
```
افتح `card.json` بأي محرر نصوص وغيّر هذي الحقول:
| الحقل | وش تكتب |
|---|---|
| `phone` | رقم جوالك مثل `+966512345678` |
| `email` | إيميلك |
| `city` | مدينتك، أو خلها فاضية |
| `linkedin` | رابط حسابك في LinkedIn، أو خله فاضي |
| `cvUrl` | رابط سيرتك في Google Drive، أو خله فاضي |

النبذة والمهارات مكتوبة. عدّل اللي تبيه منها واحذف أي مهارة ما تنطبق عليك.
تبي صورتك على البطاقة؟ حط صورة مربعة باسم `photo.png` في نفس المجلد.

## الخطوة 3: الشهادة من Apple (مرة وحدة بس)
1. افتح [صفحة Pass Type IDs](https://developer.apple.com/account/resources/identifiers/list/passTypeId) واضغط **+**.
   - اختر **Pass Type IDs** واضغط Continue.
   - في Description اكتب `Wallet Card`، وفي Identifier اكتب `pass.sa.mudhaker.card`.
   - اضغط Continue ثم Register.
2. ارجع للـ Terminal وشغّل:
   ```bash
   mkdir certs
   openssl req -new -newkey rsa:2048 -nodes -keyout certs/pass.key -out certs/pass.csr -subj "/CN=Wallet Card"
   ```
3. افتح [صفحة Certificates](https://developer.apple.com/account/resources/certificates/add).
   - اختر **Pass Type ID Certificate**، ثم اختر `pass.sa.mudhaker.card`.
   - ارفع الملف `certs/pass.csr` واضغط Download.
   - انقل الملف اللي نزل إلى مجلد `certs/` وسمّه `pass.cer`.
4. نزّل [AppleWWDRCAG4.cer](https://www.apple.com/certificateauthority/AppleWWDRCAG4.cer) وحطه في مجلد `certs/`.
5. افتح [صفحة Membership](https://developer.apple.com/account#MembershipDetailsCard) وانسخ **Team ID** (10 حروف).
   - الصقه في `card.json` مكان `XXXXXXXXXX`.

بعدها يكون مجلد `certs/` فيه 3 ملفات: `pass.key` و`pass.cer` و`AppleWWDRCAG4.cer`.
لا تشاركه مع أحد، وهو أصلاً ما ينرفع على GitHub.

## الخطوة 4: اصنع البطاقة
```bash
npm run make
```
يطلع لك ملف `my-card.pkpass`.

## الخطوة 5: أضفها للجوال
أرسل `my-card.pkpass` لجوالك بـ **AirDrop** أو أرسله لنفسك **بالإيميل**. افتحه واضغط **إضافة**، وبتلقاها في Wallet.

إذا عدلت أي شي في بياناتك بعدين، كرر الخطوة 4 و5 بس.
