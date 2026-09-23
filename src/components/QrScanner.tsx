import { CameraView, useCameraPermissions } from 'expo-camera';
import { useRef } from 'react';
import { Linking, View } from 'react-native';
import { radius, spacing, useTheme } from '@/theme';
import { AppText } from './AppText';
import { Button } from './Button';

export const scannerSupported = true;

/** ماسح QR بالكاميرا الخلفية. يستدعي onScan مرة واحدة لكل رمز جديد. */
export function QrScanner({ onScan, height = 300 }: { onScan: (data: string) => void; height?: number }) {
  const { colors } = useTheme();
  const [perm, request] = useCameraPermissions();
  const last = useRef('');

  if (!perm) return <View style={{ height }} />;
  if (!perm.granted) {
    return (
      <View style={{ height, borderRadius: radius.lg, backgroundColor: colors.surfaceAlt, alignItems: 'center', justifyContent: 'center', padding: spacing.xl, gap: spacing.md }}>
        <AppText center>نحتاج إذن الكاميرا لمسح الرمز.</AppText>
        {perm.canAskAgain ? (
          <Button title="السماح بالكاميرا" icon="camera-outline" onPress={request} />
        ) : (
          <Button title="فتح إعدادات الجوال" variant="secondary" onPress={() => Linking.openSettings()} />
        )}
      </View>
    );
  }
  return (
    <View style={{ height, borderRadius: radius.lg, overflow: 'hidden' }}>
      <CameraView
        style={{ flex: 1 }}
        facing="back"
        barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
        onBarcodeScanned={({ data }) => {
          if (data === last.current) return;
          last.current = data;
          onScan(data);
        }}
      />
      <View pointerEvents="none" style={{ position: 'absolute', top: '18%', bottom: '18%', left: '18%', right: '18%', borderWidth: 3, borderColor: '#FFFFFF', borderRadius: 20 }} />
    </View>
  );
}
