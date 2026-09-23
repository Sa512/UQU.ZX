import QRCode from 'react-native-qrcode-svg';
import { View } from 'react-native';

/** رمز QR بخلفية بيضاء دائماً (أسهل للمسح في الوضع الداكن والبروجكتر). */
export function QrCode({ value, size }: { value: string; size: number }) {
  return (
    <View style={{ backgroundColor: '#FFFFFF', padding: size * 0.06, borderRadius: 16 }} accessibilityLabel="رمز QR">
      <QRCode value={value} size={size} color="#0F172A" backgroundColor="#FFFFFF" ecl="M" />
    </View>
  );
}
