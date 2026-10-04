import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { confirm } from '@/components/confirm';
import { Field } from '@/components/Field';
import { haptic } from '@/components/haptics';
import { Screen, SectionHeader } from '@/components/Screen';
import { SignInNeeded } from '@/components/SignInNeeded';
import { Toggle } from '@/components/Toggle';
import { MIN_BACKUP_PASSWORD } from '@/lib/backupCrypto';
import { canRememberPassword, forgetPassword, recallPassword, rememberPassword } from '@/lib/backupKey';
import { cloud } from '@/lib/cloud';
import { downloadBackup, uploadBackup } from '@/lib/cloudBackup';
import { backupLabel, useBackupInfo } from '@/lib/useBackupInfo';
import { useStore } from '@/store/useStore';
import { spacing, useTheme } from '@/theme';

function BackupInner() {
  const { colors } = useTheme();
  const account = useStore((s) => s.account)!;
  const settings = useStore((s) => s.settings);
  const update = useStore((s) => s.updateSettings);
  const restoreBackup = useStore((s) => s.restoreBackup);
  const [refresh, setRefresh] = useState(0);
  const info = useBackupInfo(true, refresh);
  const [saved, setSaved] = useState<string | null>(null); // كلمة المرور المحفوظة في الخزنة
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [busy, setBusy] = useState<'up' | 'down' | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string }>();

  useEffect(() => {
    recallPassword(account.id).then(setSaved);
  }, [account.id]);

  const password = pw || saved || '';
  // أول نسخة بكلمة مرور جديدة: نطلب تأكيدها حتى لا تضيع النسخة بخطأ إملائي
  const needsConfirm = !saved && !info && pw.length > 0;
  const weak = password.length < MIN_BACKUP_PASSWORD;

  const upload = async () => {
    if (weak) return setMsg({ ok: false, text: `كلمة المرور ${MIN_BACKUP_PASSWORD} خانات على الأقل.` });
    if (needsConfirm && pw !== pw2) return setMsg({ ok: false, text: 'كلمتا المرور غير متطابقتين.' });
    setBusy('up');
    setMsg(undefined);
    try {
      await uploadBackup(password);
      if (settings.cloudBackup && canRememberPassword) {
        await rememberPassword(account.id, password);
        setSaved(password);
      }
      haptic.success();
      setPw('');
      setPw2('');
      setRefresh((n) => n + 1);
      setMsg({ ok: true, text: 'نُسخت بياناتك مشفّرة ✓' });
    } catch (e) {
      setMsg({ ok: false, text: (e as Error).message });
    } finally {
      setBusy(null);
    }
  };

  const restore = async () => {
    if (!password) return setMsg({ ok: false, text: 'اكتب كلمة مرور النسخة.' });
    setBusy('down');
    setMsg(undefined);
    try {
      const r = await downloadBackup(password);
      if (!r) return setMsg({ ok: false, text: 'لا توجد نسخة لحسابك بعد.' });
      if (!r.ok) return setMsg({ ok: false, text: r.message });
      confirm(
        'استعادة النسخة؟',
        `سيتم استبدال بيانات هذا الجهاز بـ: ${r.summary}.`,
        async () => {
          restoreBackup(r.data);
          if (canRememberPassword && settings.cloudBackup) await rememberPassword(account.id, password);
          haptic.success();
          setMsg({ ok: true, text: 'تمت استعادة بياناتك ✓' });
          router.replace('/');
        },
        'استعادة',
      );
    } catch (e) {
      const m = (e as Error).message;
      setMsg({ ok: false, text: m === 'bad_password' ? 'كلمة المرور غير صحيحة.' : m === 'bad_file' ? 'النسخة تالفة.' : m });
    } finally {
      setBusy(null);
    }
  };

  const toggleAuto = async (on: boolean) => {
    setMsg(undefined);
    if (!on) {
      await forgetPassword(account.id);
      setSaved(null);
      return update({ cloudBackup: false });
    }
    if (!password || weak) return setMsg({ ok: false, text: 'اكتب كلمة المرور أولاً، ثم فعّل النسخ التلقائي.' });
    await rememberPassword(account.id, password);
    setSaved(password);
    update({ cloudBackup: true });
    setMsg({ ok: true, text: 'سنحفظ نسخة يومياً عند تغيّر بياناتك ✓' });
  };

  return (
    <Screen back title="النسخة السحابية" subtitle="مشفّرة على جوالك قبل أن تُرفع">
      <Card style={{ gap: spacing.sm }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
          <Ionicons name={info ? 'cloud-done' : 'cloud-outline'} size={24} color={info ? colors.success : colors.textMuted} />
          <AppText variant="h3" style={{ flex: 1 }}>
            {info === undefined ? 'نتحقق من نسختك…' : info ? 'آخر نسخة' : 'لا توجد نسخة بعد'}
          </AppText>
        </View>
        {info && (
          <AppText variant="caption" muted>
            {backupLabel(info)}
          </AppText>
        )}
      </Card>

      <Card style={{ gap: spacing.sm, flexDirection: 'row' }}>
        <Ionicons name="lock-closed" size={20} color={colors.primary} style={{ marginTop: 2 }} />
        <AppText variant="caption" muted style={{ flex: 1 }}>
          كل بياناتك (المواد، الجدول، المهام، الملخصات، البطاقات، المعدل، وطلابك ودرجاتهم للدكتور) تُشفَّر بكلمة مرور تختارها (AES-256) ثم تُرفع. لا نستطيع قراءتها، ولا استعادتها إن نسيت كلمة المرور.
        </AppText>
      </Card>

      <SectionHeader title="كلمة مرور النسخة" />
      <Card style={{ gap: spacing.md }}>
        {saved ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
            <Ionicons name="key" size={18} color={colors.success} />
            <AppText variant="caption" style={{ flex: 1 }}>
              محفوظة في خزنة جوالك المشفّرة ✓
            </AppText>
          </View>
        ) : null}
        <Field
          label={saved ? 'كلمة مرور أخرى (اختياري)' : 'كلمة المرور'}
          value={pw}
          onChangeText={setPw}
          secureTextEntry
          ltr
          placeholder={`${MIN_BACKUP_PASSWORD} خانات على الأقل`}
          hint="ليست كلمة مرور حسابك. احفظها جيداً: بدونها لا تُستعاد النسخة."
        />
        {needsConfirm && <Field label="أكّد كلمة المرور" value={pw2} onChangeText={setPw2} secureTextEntry ltr />}
        {canRememberPassword && (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
            <View style={{ flex: 1 }}>
              <AppText variant="label">نسخ تلقائي يومي</AppText>
              <AppText variant="caption" muted>
                عند فتح التطبيق، مرة يومياً إن تغيّرت بياناتك. تُحفظ كلمة المرور في خزنة الجوال لهذا الغرض.
              </AppText>
            </View>
            <Toggle accessibilityLabel="نسخ تلقائي يومي" value={settings.cloudBackup} onValueChange={toggleAuto} />
          </View>
        )}
      </Card>

      <Button title="انسخ الآن" icon="cloud-upload" size="lg" loading={busy === 'up'} disabled={!!busy} onPress={upload} />
      <Button title="استعادة من النسخة" icon="cloud-download-outline" variant="secondary" loading={busy === 'down'} disabled={!!busy || !info} onPress={restore} />
      {msg && (
        <AppText variant="label" center color={msg.ok ? colors.success : colors.danger}>
          {msg.text}
        </AppText>
      )}
      {info && (
        <Button
          title="حذف النسخة من الخادم"
          variant="ghost"
          icon="trash-outline"
          onPress={() =>
            confirm('حذف النسخة السحابية؟', 'تبقى بيانات هذا الجهاز كما هي.', async () => {
              await cloud.deleteBackup();
              await forgetPassword(account.id);
              setSaved(null);
              update({ cloudBackup: false, lastCloudBackupAt: null, lastCloudBackupHash: '' });
              setRefresh((n) => n + 1);
              setMsg({ ok: true, text: 'حُذفت النسخة ✓' });
            }, 'حذف')
          }
        />
      )}
    </Screen>
  );
}

export default function Backup() {
  return (
    <SignInNeeded title="النسخة السحابية" feature="backup">
      <BackupInner />
    </SignInNeeded>
  );
}
