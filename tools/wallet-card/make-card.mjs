// يصنع بطاقة تعريف شخصية لـ Apple Wallet (‎.pkpass) من card.json.
// الاستخدام: npm install && npm run make   ← يطلع ملف my-card.pkpass
import { X509Certificate, randomUUID } from 'node:crypto';
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';
import { PKPass } from 'passkit-generator';

const here = (p) => new URL(p, import.meta.url);
const fail = (msg) => {
  console.error(`\n✗ ${msg}\n`);
  process.exit(1);
};

if (!existsSync(here('card.json'))) fail('انسخ card.example.json إلى card.json واكتب بياناتك فيه.');
const card = JSON.parse(readFileSync(here('card.json'), 'utf8'));

// ── الشهادات: ضع في مجلد certs/ ملف pass.cer وملف المفتاح pass.key وملف AppleWWDRCAG4.cer ──
function certs() {
  const dir = here('certs/');
  if (!existsSync(dir)) fail('مجلد certs/ غير موجود (راجع README.md: خطوة الشهادات).');
  const files = readdirSync(dir);
  const read = (re, what) => {
    const f = files.find((n) => re.test(n));
    if (!f) fail(`ما لقيت ${what} داخل certs/`);
    return readFileSync(new URL(f, dir));
  };
  // ملفات ‎.cer من أبل بصيغة DER؛ نحولها إلى PEM تلقائياً
  const pem = (buf) => (buf.includes('-----BEGIN') ? buf.toString() : new X509Certificate(buf).toString());
  return {
    wwdr: pem(read(/wwdr/i, 'شهادة Apple WWDR (AppleWWDRCAG4.cer)')),
    signerCert: pem(read(/^(?!.*wwdr).*\.(cer|pem|crt)$/i, 'شهادة البطاقة pass.cer')),
    signerKey: read(/\.key$/i, 'المفتاح pass.key').toString(),
    signerKeyPassphrase: card.keyPassphrase,
  };
}

// ── أيقونة بلون البطاقة (Wallet يطلب icon.png إجبارياً) ──
function solidPng(size, hex) {
  const [r, g, b] = rgb(hex);
  const row = Buffer.alloc(1 + size * 3);
  for (let i = 0; i < size; i++) row.set([r, g, b], 1 + i * 3);
  const raw = Buffer.concat(Array.from({ length: size }, () => row));
  const crcTable = Array.from({ length: 256 }, (_, n) => {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    return c >>> 0;
  });
  const crc = (buf) => {
    let c = 0xffffffff;
    for (const x of buf) c = crcTable[(c ^ x) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  };
  const chunk = (type, data) => {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const body = Buffer.concat([Buffer.from(type), data]);
    const sum = Buffer.alloc(4);
    sum.writeUInt32BE(crc(body));
    return Buffer.concat([len, body, sum]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr.set([8, 2, 0, 0, 0], 8);
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}

function rgb(hex) {
  const h = hex.replace('#', '');
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
}
const css = (hex) => `rgb(${rgb(hex).join(', ')})`;

// ── رمز QR: بطاقة اتصال (vCard) تنحفظ مباشرة في جهات اتصال من يمسحها ──
const vcard = [
  'BEGIN:VCARD',
  'VERSION:3.0',
  `N:;${card.nameEn};;;`,
  `FN:${card.nameEn}`,
  card.titleEn && `TITLE:${card.titleEn}`,
  card.phone && `TEL;TYPE=CELL:${card.phone}`,
  card.email && `EMAIL:${card.email}`,
  card.linkedin && `URL:${card.linkedin}`,
  'END:VCARD',
]
  .filter(Boolean)
  .join('\r\n');

const color = card.color || '#1E293B';
const files = { 'icon.png': solidPng(29, color), 'icon@2x.png': solidPng(58, color), 'icon@3x.png': solidPng(87, color) };
// صورتك الشخصية (اختياري): ضع photo.png بجانب هذا الملف
if (existsSync(here('photo.png'))) files['thumbnail.png'] = files['thumbnail@2x.png'] = readFileSync(here('photo.png'));

const pass = new PKPass(files, certs(), {
  formatVersion: 1,
  passTypeIdentifier: card.passTypeIdentifier,
  teamIdentifier: card.teamIdentifier,
  serialNumber: randomUUID(),
  organizationName: card.nameAr,
  description: `بطاقة تعريف ${card.nameAr}`,
  logoText: 'بطاقة تعريف',
  backgroundColor: css(color),
  foregroundColor: 'rgb(255, 255, 255)',
  labelColor: 'rgb(203, 213, 225)',
});
pass.type = 'generic';

const right = 'PKTextAlignmentRight';
pass.primaryFields.push({ key: 'name', label: card.titleAr, value: card.nameAr });
pass.secondaryFields.push({ key: 'phone', label: 'الجوال', value: card.phone, textAlignment: right });
pass.auxiliaryFields.push(
  { key: 'email', label: 'الإيميل', value: card.email, textAlignment: right },
  ...(card.city ? [{ key: 'city', label: 'المدينة', value: card.city, textAlignment: right }] : []),
);
pass.backFields.push(
  ...[
    ['about', 'نبذة عني', card.about],
    ['skills', 'المهارات', card.skills],
    ['phone2', 'الجوال', card.phone],
    ['email2', 'الإيميل', card.email],
    ['linkedin', 'LinkedIn', card.linkedin],
    ['cv', 'السيرة الذاتية', card.cvUrl],
  ]
    .filter(([, , v]) => v)
    .map(([key, label, value]) => ({ key, label, value, textAlignment: right })),
);
pass.setBarcodes({ format: 'PKBarcodeFormatQR', message: vcard, messageEncoding: 'iso-8859-1', altText: 'امسح الرمز لحفظ بياناتي' });

writeFileSync(here('my-card.pkpass'), pass.getAsBuffer());
console.log('\n✓ جاهزة: my-card.pkpass\n  أرسلها لجوالك (AirDrop أو إيميل) وافتحها ← «إضافة» إلى Wallet.\n');
