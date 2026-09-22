import { useEffect, useState } from 'react';
import { Modal, Pressable, View } from 'react-native';
import { radius, spacing, useTheme } from '@/theme';
import { AppText } from './AppText';
import { Button } from './Button';
import { registerConfirmHost, type ConfirmRequest } from './confirm';

/** نافذة تأكيد داخل التطبيق تُستخدم على الويب. */
export function ConfirmHost() {
  const { colors } = useTheme();
  const [req, setReq] = useState<ConfirmRequest | null>(null);
  useEffect(() => {
    registerConfirmHost(setReq);
    return () => registerConfirmHost(null);
  }, []);
  if (!req) return null;
  const close = () => setReq(null);
  return (
    <Modal transparent visible animationType="fade" onRequestClose={close}>
      <Pressable accessibilityLabel="إغلاق" onPress={close} style={{ flex: 1, backgroundColor: colors.overlay, justifyContent: 'center', padding: spacing.xl }}>
        <Pressable
          onPress={() => {}}
          accessibilityRole="alert"
          style={{ backgroundColor: colors.surface, borderRadius: radius.xl, padding: spacing.xl, gap: spacing.md, maxWidth: 420, width: '100%', alignSelf: 'center' }}
        >
          <AppText variant="h2">{req.title}</AppText>
          <AppText muted>{req.message}</AppText>
          <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm }}>
            <Button style={{ flex: 1 }} title="إلغاء" variant="ghost" onPress={close} />
            <Button
              style={{ flex: 1 }}
              title={req.yes}
              variant="danger"
              onPress={() => {
                close();
                req.onYes();
              }}
            />
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
