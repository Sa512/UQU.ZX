import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import Constants from 'expo-constants';
import appJson from '../../app.json';
import { useState } from 'react';
import { Linking, Platform, View } from 'react-native';
import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Chip, ChipRow } from '@/components/Chip';
import { confirm } from '@/components/confirm';
import { Field } from '@/components/Field';
import { UniversityField } from '@/components/UniversityField';
import { Stepper } from '@/components/Pickers';
import { Toggle } from '@/components/Toggle';
import { Screen, SectionHeader } from '@/components/Screen';
import { Segmented } from '@/components/Segmented';
import { APP_INFO } from '@/content/app';
import { ROLE_LABEL, STATUS_LABEL } from '@/lib/accounts';
import { buildBackup, parseBackup, type ParseResult } from '@/lib/backup';
import { cloud } from '@/lib/cloud';
import { lockAvailable, unlock } from '@/lib/appLock';
import { backupSupported, pickBackup, secureRandom, shareBackup } from '@/lib/backupIO';
import { decryptBackup, encryptBackup, isEncryptedBackup, MIN_BACKUP_PASSWORD } from '@/lib/backupCrypto';
import { formatDuration } from '@/lib/dates';
import type { GradeScale } from '@/lib/gpa';
import { remindersSupported, sendTestReminder } from '@/lib/notifications';
import { turnOnReminders } from '@/lib/useReminderSync';
import { ar, MINUTES, WEEKS } from '@/lib/plural';
import { useStore, type Role, type ThemePref } from '@/store/useStore';
import { spacing, useTheme } from '@/theme';

export default function Settings() {
  const { colors } = useTheme();
  const settings = useStore((s) => s.settings);
  const update = useStore((s) => s.updateSettings);
  const resetAll = useStore((s) => s.resetAll);
  const forgetCloudLinks = useStore((s) => s.forgetCloudLinks);
  const [lockMsg, setLockMsg] = useState<string>();
  // تشغيل القفل أو إيقافه يتطلب البصمة نفسها، حتى لا يوقفه غيرك
  const toggleLock = async (on: boolean) => {
    setLockMsg(undefined);
    if (on && !(await lockAvailable())) return setLockMsg(Platform.OS === 'web' ? 'القفل متاح في تطبيق الجوال.' : 'فعّل بصمة الوجه أو الإصبع أو رمز الجوال من إعدادات جوالك أولاً.');
    if (await unlock()) update({ appLock: on });
  };
  const [cloudMsg, setCloudMsg] = useState<{ ok: boolean; text: string }>();
  const loadSample = useStore((s) => s.loadSampleData);
  const hasData = useStore((s) => s.courses.length > 0);
  const [name, setName] = useState(settings.name);
  const [university, setUniversity] = useState(settings.university);
  const [major, setMajor] = useState(settings.major);
  const [uniIdText, setUniIdText] = useState(settings.uniId);
  const [reminderMsg, setReminderMsg] = useState<string>();
  const [backupMsg, setBackupMsg] = useState<string>();
  const [backupPw, setBackupPw] = useState('');
  const [backupBusy, setBackupBusy] = useState(false);
  const [lockedBackup, setLockedBackup] = useState<string | null>(null); // نسخة مشفّرة تنتظر كلمة المرور
  const hasStudentData = useStore((s) => s.students.length > 0);
  const askRestore = (r: ParseResult) => {
    if (!r.ok) return setBackupMsg(r.message);
    confirm(
      'استعادة النسخة؟',
      `سيتم استبدال بياناتك الحالية بـ: ${r.summary}.`,
      () => {
        restoreBackup(r.data);
        setBackupMsg('تمت استعادة بياناتك بنجاح ✓');
      },
      'استعادة',
    );
  };
  const restoreBackup = useStore((s) => s.restoreBackup);

  const account = useStore((s) => s.account);
  const setAccount = useStore((s) => s.setAccount);
  const [accountMsg, setAccountMsg] = useState<string>();
  /** يحدّث الاسم والجامعة والدور على الخادم (هو من يحسم الدور حسب الإيميل). */
  const syncProfile = async (p: { name?: string; role?: Role; university?: string }) => {
    if (!account) return;
    setAccountMsg(undefined);
    try {
      setAccount(await cloud.completeProfile(p.name ?? account.full_name, p.role ?? account.role, p.university ?? account.university));
    } catch (e) {
      setAccountMsg((e as Error).message);
    }
  };
  const saveProfile = () => {
    update({ name: name.trim() || settings.name, university: university.trim(), major: major.trim() });
    if (account && name.trim().length >= 2 && name.trim() !== account.full_name) syncProfile({ name: name.trim() });
  };

  return (
    <Screen back title="الإعدادات">
      <SectionHeader title="الملف الشخصي" />
      <Card style={{ gap: spacing.md }}>
        {account && (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
            <Ionicons name="person-circle" size={40} color={colors.primary} />
            <View style={{ flex: 1 }}>
              <AppText variant="label" style={{ writingDirection: 'ltr', textAlign: 'right' }} numberOfLines={1}>
                {account.email}
              </AppText>
              <AppText variant="caption" muted>
                {ROLE_LABEL[account.role]}
                {account.role === 'professor' ? ` · ${STATUS_LABEL[account.status]}` : ''}
                {account.is_admin ? ' · مشرف' : ''}
              </AppText>
            </View>
            <Button
              title="خروج"
              size="sm"
              variant="ghost"
              icon="log-out-outline"
              onPress={() =>
                confirm('تسجيل الخروج؟', 'بيانات جهازك تبقى، وتحتاج تسجيل الدخول لاستخدام التطبيق.', async () => {
                  await cloud.signOut();
                  setAccount(null);
                  router.replace('/auth');
                }, 'تسجيل الخروج')
              }
            />
          </View>
        )}
        {account?.role === 'professor' && account.status === 'pending' && (
          <AppText variant="caption" color={colors.warning}>
            حسابك كعضو هيئة تدريس بانتظار موافقة المشرف، لأن نطاق إيميلك غير معروف لدينا. تستخدم كل الأدوات الآن، ويظهر اسمك في دليل الساعات المكتبية بعد الموافقة.
          </AppText>
        )}
        <Field label="الاسم" value={name} onChangeText={setName} onBlur={saveProfile} onEndEditing={saveProfile} />
        <UniversityField value={university} onChange={(v) => { setUniversity(v); update({ university: v.trim() }); }} onPick={(v) => syncProfile({ university: v })} />
        {settings.role === 'student' && (
          <Field label="الرقم الجامعي" value={uniIdText} onChangeText={setUniIdText} onBlur={() => update({ uniId: uniIdText.replace(/\D/g, '') })} onEndEditing={() => update({ uniId: uniIdText.replace(/\D/g, '') })} keyboardType="number-pad" hint="يُستخدم للتحضير بالـ QR وحجز الساعات المكتبية" ltr />
        )}
        <Field label={settings.role === 'student' ? 'التخصص' : 'القسم'} value={major} onChangeText={setMajor} onBlur={saveProfile} onEndEditing={saveProfile} />
        {!account && (
        <View style={{ gap: 6 }}>
          <AppText variant="label">الدور</AppText>
          <Segmented<Role>
            value={settings.role}
            onChange={(role) => (account ? syncProfile({ role }) : update({ role }))}
            options={[
              { value: 'student', label: 'طالب' },
              { value: 'professor', label: 'عضو هيئة تدريس' },
            ]}
          />
        </View>
        )}
        {accountMsg && (
          <AppText variant="caption" color={colors.danger}>
            {accountMsg}
          </AppText>
        )}
      </Card>

      <SectionHeader title="المظهر" />
      <Card style={{ gap: spacing.md }}>
        <Segmented<ThemePref>
          value={settings.theme}
          onChange={(theme) => update({ theme })}
          options={[
            { value: 'light', label: 'نهاري ☀️' },
            { value: 'dark', label: 'ليلي 🌙' },
            { value: 'time', label: 'حسب الوقت' },
            { value: 'system', label: 'الجوال' },
          ]}
        />
        <AppText variant="caption" muted>
          {settings.theme === 'time' ? 'ليلي من 6 مساءً حتى 6 صباحاً، ونهاري باقي اليوم.' : settings.theme === 'system' ? 'يتبع إعداد المظهر في جوالك.' : 'تقدر تبدّل بسرعة من زر الشمس والقمر في الرئيسية.'}
        </AppText>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <View style={{ flex: 1 }}>
            <AppText variant="label">الاهتزاز عند اللمس</AppText>
            <AppText variant="caption" muted>
              ردة فعل لمسية خفيفة للأزرار
            </AppText>
          </View>
          <Toggle accessibilityLabel="الاهتزاز عند اللمس" value={settings.haptics} onValueChange={(haptics) => update({ haptics })} />
        </View>
      </Card>

      <SectionHeader title="التذكيرات" />
      <Card style={{ gap: spacing.md }}>
        {!remindersSupported ? (
          <AppText variant="caption" muted>
            التذكيرات متاحة في تطبيق الجوال (iOS وAndroid).
          </AppText>
        ) : (
          <>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <View style={{ flex: 1 }}>
                <AppText variant="label">تذكير بالمحاضرات والمواعيد</AppText>
                <AppText variant="caption" muted>
                  قبل المحاضرة، ومساء اليوم السابق للتسليم وصباحه، وقبل الاختبار بثلاثة أيام
                </AppText>
              </View>
              <Toggle
                accessibilityLabel="تذكير بالمحاضرات والمواعيد"
                value={settings.remindersEnabled}
                onValueChange={async (on) => {
                  setReminderMsg(undefined);
                  if (!on) return update({ remindersEnabled: false });
                  if (!(await turnOnReminders())) setReminderMsg('لم يُسمح بالإشعارات. فعّلها لتطبيق مذاكر من إعدادات الجوال.');
                }}
              />
            </View>
            {settings.remindersEnabled && (
              <View style={{ gap: 8 }}>
                <AppText variant="label">قبل المحاضرة بـ</AppText>
                <ChipRow>
                  {[5, 10, 15, 30, 60].map((m) => (
                    <Chip key={m} label={m === 60 ? 'ساعة' : ar(m, MINUTES)} selected={settings.lectureLeadMin === m} onPress={() => update({ lectureLeadMin: m })} />
                  ))}
                </ChipRow>
                <Button
                  title="أرسل تذكيراً تجريبياً"
                  variant="ghost"
                  icon="notifications-outline"
                  size="sm"
                  onPress={async () => setReminderMsg((await sendTestReminder()) ? 'سيصلك تذكير تجريبي خلال 5 ثوانٍ.' : 'لم يُسمح بالإشعارات.')}
                />
              </View>
            )}
            {reminderMsg && (
              <View style={{ gap: 6 }}>
                <AppText variant="caption" color={colors.info}>
                  {reminderMsg}
                </AppText>
                {reminderMsg.includes('إعدادات الجوال') && <Button title="فتح إعدادات الجوال" variant="secondary" size="sm" onPress={() => Linking.openSettings()} />}
              </View>
            )}
          </>
        )}
      </Card>

      <SectionHeader title="الدراسة" />
      <Card style={{ gap: spacing.md }}>
        <View style={{ gap: 6 }}>
          <AppText variant="label">الهدف اليومي للمذاكرة</AppText>
          <Stepper value={settings.dailyGoalMin} onChange={(dailyGoalMin) => update({ dailyGoalMin })} min={15} max={600} step={15} format={formatDuration} />
        </View>
        <View style={{ gap: 6 }}>
          <AppText variant="label">عدد أسابيع الفصل الدراسي</AppText>
          <AppText variant="caption" muted>
            يُستخدم لحساب نسبة الغياب المسموح (25%)
          </AppText>
          <Stepper value={settings.semesterWeeks} onChange={(semesterWeeks) => update({ semesterWeeks })} min={8} max={20} format={(n) => ar(n, WEEKS)} />
        </View>
        <View style={{ gap: 6 }}>
          <AppText variant="label">مدة الاستراحة</AppText>
          <Stepper value={settings.breakMin} onChange={(breakMin) => update({ breakMin })} min={1} max={30} format={(n) => ar(n, MINUTES)} />
        </View>
        <View style={{ gap: 6 }}>
          <AppText variant="label">نظام المعدل</AppText>
          <Segmented<GradeScale>
            value={settings.gradeScale}
            onChange={(gradeScale) => update({ gradeScale })}
            options={[
              { value: 5, label: 'من 5' },
              { value: 4, label: 'من 4' },
            ]}
          />
        </View>
      </Card>

      <SectionHeader title="البيانات والخصوصية" />
      <Card style={{ gap: spacing.md }}>
        <AppText variant="caption" muted>
          معظم بياناتك محفوظة على جهازك فقط. الحجز والتحضير بالـ QR وقناة الشعبة تستخدم خادماً. صدّر نسخة احتياطية قبل تغيير جوالك.
        </AppText>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
          <View style={{ flex: 1 }}>
            <AppText variant="label">قفل التطبيق بالبصمة</AppText>
            <AppText variant="caption" muted>
              {settings.role === 'professor' ? 'موصى به: يحمي أسماء طلابك وأرقامهم على جوالك.' : 'يطلب بصمة الوجه أو الإصبع عند فتح التطبيق.'}
            </AppText>
          </View>
          <Toggle accessibilityLabel="قفل التطبيق بالبصمة" value={settings.appLock} onValueChange={toggleLock} />
        </View>
        {lockMsg && (
          <AppText variant="caption" color={colors.danger}>
            {lockMsg}
          </AppText>
        )}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
          <View style={{ flex: 1 }}>
            <AppText variant="label">بلاغات الأعطال</AppText>
            <AppText variant="caption" muted>
              عند حدوث خطأ يُرسل نصه فقط (بعد حذف الإيميلات والأرقام) بلا اسمك أو حسابك، لنصلحه بسرعة.
            </AppText>
          </View>
          <Toggle accessibilityLabel="بلاغات الأعطال" value={settings.crashReports} onValueChange={(v) => update({ crashReports: v })} />
        </View>
        {!hasData && <Button title="تحميل جدول تجريبي" variant="secondary" icon="sparkles" onPress={loadSample} />}
        {backupSupported && (
          <>
            <Field
              label="كلمة مرور للنسخة"
              placeholder={hasStudentData ? 'مطلوبة: النسخة فيها بيانات طلابك' : 'اختيارية (8 خانات على الأقل)'}
              value={backupPw}
              onChangeText={setBackupPw}
              secureTextEntry
              hint="تُشفَّر النسخة بها (AES-256). احفظها جيداً: بدونها لا يمكن استعادة الملف."
              ltr
            />
            <Button
              title={backupPw ? 'تصدير نسخة مشفّرة' : 'تصدير نسخة احتياطية'}
              variant="secondary"
              icon={backupPw ? 'lock-closed-outline' : 'cloud-upload-outline'}
              loading={backupBusy}
              disabled={(hasStudentData || !!backupPw) && backupPw.length < MIN_BACKUP_PASSWORD}
              onPress={async () => {
                const s = useStore.getState();
                const text = JSON.stringify(
                  buildBackup({ settings: s.settings, courses: s.courses, slots: s.slots, tasks: s.tasks, sessions: s.sessions, decks: s.decks, summaries: s.summaries, assessments: s.assessments, sections: s.sections, students: s.students, attendance: s.attendance, gradeItems: s.gradeItems, scores: s.scores, gpa: s.gpa }),
                );
                setBackupBusy(true);
                try {
                  const out = backupPw ? JSON.stringify(await encryptBackup(text, backupPw, secureRandom)) : text;
                  const r = await shareBackup(out);
                  setBackupMsg(r.ok ? undefined : r.message);
                } finally {
                  setBackupBusy(false);
                }
              }}
            />
            <Button
              title="استعادة من نسخة احتياطية"
              variant="ghost"
              icon="cloud-download-outline"
              onPress={async () => {
                setBackupMsg(undefined);
                let text: string | null;
                try {
                  text = await pickBackup();
                } catch {
                  return setBackupMsg('تعذّر قراءة الملف.');
                }
                if (!text) return;
                if (isEncryptedBackup(text)) {
                  setLockedBackup(text);
                  setBackupPw('');
                  return setBackupMsg('النسخة مشفّرة: اكتب كلمة مرورها في الحقل أعلاه ثم اضغط «فك التشفير».');
                }
                askRestore(parseBackup(text));
              }}
            />
            {lockedBackup && (
              <Button
                title="فك التشفير والاستعادة"
                icon="key-outline"
                loading={backupBusy}
                disabled={!backupPw}
                onPress={async () => {
                  setBackupBusy(true);
                  try {
                    const plain = await decryptBackup(lockedBackup, backupPw);
                    setLockedBackup(null);
                    askRestore(parseBackup(plain));
                  } catch (e) {
                    setBackupMsg((e as Error).message === 'bad_file' ? 'الملف تالف.' : 'كلمة المرور غير صحيحة أو الملف معدّل.');
                  } finally {
                    setBackupBusy(false);
                  }
                }}
              />
            )}
            {backupMsg && (
              <AppText variant="caption" color={backupMsg.includes('✓') ? colors.success : colors.danger}>
                {backupMsg}
              </AppText>
            )}
          </>
        )}
        <Button title="الاشتراك والمدفوعات" variant="ghost" icon="diamond-outline" onPress={() => router.push('/pro')} />
        <Button title="سياسة الخصوصية" variant="ghost" icon="shield-checkmark-outline" onPress={() => router.push({ pathname: '/legal', params: { doc: 'privacy' } })} />
        <Button title="شروط الاستخدام" variant="ghost" icon="document-text-outline" onPress={() => router.push({ pathname: '/legal', params: { doc: 'terms' } })} />
        <Button title="تواصل مع الدعم" variant="ghost" icon="mail-outline" onPress={() => Linking.openURL(`mailto:${APP_INFO.supportEmail}?subject=${encodeURIComponent('دعم تطبيق مذاكر')}`)} />
        <Button
          title="حذف بياناتي من الخادم"
          variant="ghost"
          icon="cloud-offline-outline"
          onPress={() =>
            confirm('حذف بياناتك من الخادم؟', 'تُحذف حجوزاتك وتحضيراتك، وصفحات الساعات المكتبية وقنوات الشعب التي نشرتها. بيانات جهازك تبقى.', async () => {
              try {
                await cloud.deleteMyData();
                forgetCloudLinks();
                setCloudMsg({ ok: true, text: 'حُذفت بياناتك من الخادم ✓' });
              } catch (e) {
                setCloudMsg({ ok: false, text: (e as Error).message });
              }
            })
          }
        />
        {cloudMsg && (
          <AppText variant="caption" center color={cloudMsg.ok ? colors.success : colors.danger}>
            {cloudMsg.text}
          </AppText>
        )}
        {account && (
          <>
            <Button title="تغيير كلمة المرور" variant="ghost" icon="key-outline" onPress={() => router.push({ pathname: '/auth', params: { mode: 'forgot', email: account.email } })} />
            <Button
              title="الخروج من كل الأجهزة"
              variant="ghost"
              icon="phone-portrait-outline"
              onPress={() =>
                confirm('الخروج من كل الأجهزة؟', 'تُنهى جلسات حسابك على كل الأجوال والمتصفحات، بما فيها هذا الجوال. استخدمه إن فقدت جوالاً أو شككت أن أحداً دخل حسابك.', async () => {
                  await cloud.signOut(true);
                  setAccount(null);
                  router.replace('/auth');
                }, 'خروج من الكل')
              }
            />
          </>
        )}
        {account && (
          <Button
            title="حذف حسابي نهائياً"
            variant="ghost"
            icon="person-remove-outline"
            onPress={() =>
              confirm('حذف حسابك نهائياً؟', 'يُحذف حسابك وكل بياناتك على الخادم (حجوزات، صفحات، قنوات)، وتُمسح بيانات هذا الجهاز. لا يمكن التراجع.', async () => {
                try {
                  await cloud.deleteAccount();
                  resetAll();
                  router.replace('/onboarding');
                } catch (e) {
                  setCloudMsg({ ok: false, text: (e as Error).message });
                }
              }, 'حذف الحساب')
            }
          />
        )}
        <Button
          title="حذف جميع البيانات"
          variant="danger"
          icon="trash-outline"
          onPress={() =>
            confirm('حذف جميع البيانات؟', 'سيُحذف كل شيء من جهازك ومن الخادم نهائياً ولا يمكن التراجع.', async () => {
              // نحاول الخادم أولاً؛ إن لم يتوفر إنترنت تبقى بيانات الخادم وتُحذف تلقائياً حسب مدد الحفظ
              await cloud.deleteMyData().catch(() => {});
              await cloud.signOut();
              resetAll();
              router.replace('/onboarding');
            })
          }
        />
      </Card>

      <AppText variant="tiny" muted center>
        مذاكر · الإصدار {Constants.expoConfig?.version ?? appJson.expo.version} · صُنع بحب لطلاب الجامعات 💜
      </AppText>
    </Screen>
  );
}
