import { Ionicons } from '@expo/vector-icons';
import { useCallback, useEffect, useState } from 'react';
import { View } from 'react-native';
import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Chip, ChipRow } from '@/components/Chip';
import { confirm } from '@/components/confirm';
import { EmptyState } from '@/components/EmptyState';
import { Field } from '@/components/Field';
import { haptic } from '@/components/haptics';
import { Pill } from '@/components/Rows';
import { HeaderButton, Screen, SectionHeader } from '@/components/Screen';
import { Segmented } from '@/components/Segmented';
import { ROLE_LABEL, STATUS_LABEL, usersCsv, type AccountRole, type AccountStatus } from '@/lib/accounts';
import { activeRate, monthKey, monthLabel, reportCsv, reportRows } from '@/lib/adminReport';
import { cleanConfig, compareVersions, FEATURES } from '@/lib/appConfig';
import { APP_VERSION } from '@/lib/appVersion';
import { Toggle } from '@/components/Toggle';
import { cloud, CloudError, type AppConfig, type AdminReport, type AdminError, type AdminLogEntry, type AdminOverview, type AdminRules, type AdminUser } from '@/lib/cloud';
import { formatShortDate, toDateKey } from '@/lib/dates';
import { shareCsv } from '@/lib/exportIO';
import { useStore } from '@/store/useStore';
import { spacing, useTheme } from '@/theme';

type Filter = 'all' | 'student' | 'professor' | 'pending';

/** لوحة المشرف: الأرقام، والموافقة على الدكاترة، والبحث في المستخدمين، والتصدير إلى Excel، وقواعد الإيميلات. */
export default function Admin() {
  const { colors } = useTheme();
  const isAdmin = useStore((s) => !!s.account?.is_admin);
  const [ov, setOv] = useState<AdminOverview | null>(null);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [rules, setRules] = useState<AdminRules | null>(null);
  const [log, setLog] = useState<AdminLogEntry[]>([]);
  const [errors, setErrors] = useState<AdminError[]>([]);
  const [month, setMonth] = useState<0 | -1>(0);
  const [report, setReport] = useState<AdminReport | null>(null);
  const [reportBusy, setReportBusy] = useState(false);
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [open, setOpen] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string }>();
  const [busy, setBusy] = useState(false);
  const [ovEmail, setOvEmail] = useState('');
  const [ovRole, setOvRole] = useState<AccountRole | 'admin'>('student');
  const [dom, setDom] = useState('');
  const [domUni, setDomUni] = useState('');
  const [domKind, setDomKind] = useState<'staff' | 'student'>('staff');
  // التحكم الطارئ: نسخة قابلة للتعديل من إعدادات الخادم
  const [cfg, setCfg] = useState<Omit<AppConfig, 'updated_at'> | null>(null);
  const setRemoteConfig = useStore((s) => s.setRemoteConfig);

  const loadUsers = useCallback(async (query: string, f: Filter) => {
    const role = f === 'student' || f === 'professor' ? f : null;
    const status: AccountStatus | null = f === 'pending' ? 'pending' : null;
    setUsers(await cloud.adminUsers(query, role, status));
  }, []);
  const refresh = useCallback(async () => {
    try {
      const [o, r, l, e, c] = await Promise.all([cloud.adminOverview(), cloud.adminRules(), cloud.adminLog(), cloud.adminErrors(), cloud.getAppConfig()]);
      if (c) {
        const { updated_at: _u, ...rest } = c;
        setCfg(rest);
      }
      setOv(o);
      setRules(r);
      setLog(l);
      setErrors(e);
    } catch (e) {
      setMsg({ ok: false, text: (e as Error).message });
    }
  }, []);

  useEffect(() => {
    if (!isAdmin) return;
    Promise.resolve().then(refresh);
  }, [isAdmin, refresh]);
  useEffect(() => {
    if (!isAdmin) return;
    const t = setTimeout(() => loadUsers(q, filter).catch((e) => setMsg({ ok: false, text: (e as Error).message })), q ? 300 : 0);
    return () => clearTimeout(t);
  }, [isAdmin, q, filter, loadUsers]);

  if (!isAdmin) {
    return (
      <Screen back title="لوحة المشرف">
        <EmptyState icon="lock-closed-outline" title="للمشرف فقط" />
      </Screen>
    );
  }

  const act = async (fn: () => Promise<void>, ok: string) => {
    setBusy(true);
    setMsg(undefined);
    try {
      await fn();
      haptic.success();
      setMsg({ ok: true, text: ok });
      await Promise.all([refresh(), loadUsers(q, filter)]);
    } catch (e) {
      setMsg({ ok: false, text: (e as Error).message });
    } finally {
      setBusy(false);
    }
  };

  const exportExcel = () =>
    act(async () => {
      const rows = await cloud.adminExport();
      const r = await shareCsv(`mudhaker-users-${toDateKey(new Date())}.csv`, usersCsv(rows));
      if (!r.ok) throw new Error(r.message);
    }, 'جهّزنا ملف Excel ✓');

  const setUser = (u: AdminUser, role: AccountRole, status: AccountStatus, label: string) => act(() => cloud.adminSetUser(u.id, role, status), `${u.full_name}: ${label} ✓`);

  const stats: [string, number | undefined, string][] = [
    ['الطلاب', ov?.students, 'school'],
    ['الدكاترة', ov?.professors, 'ribbon'],
    ['بانتظار الموافقة', ov?.pending, 'hourglass'],
    ['جديد هذا الأسبوع', ov?.new_week, 'person-add'],
    ['نشطون هذا الأسبوع', ov?.active_week, 'pulse'],
    ['صفحات حجز مفتوحة', ov?.open_pages, 'calendar'],
    ['حجوزات الأسبوع', ov?.bookings_week, 'checkmark-done'],
    ['أعطال الأسبوع', ov?.errors_week, 'bug'],
  ];

  return (
    <Screen back title="لوحة المشرف" subtitle="البيانات مباشرة من الخادم" right={<HeaderButton icon="refresh" label="تحديث" onPress={() => { refresh(); loadUsers(q, filter); }} />}>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
        {stats.map(([label, n, icon]) => (
          <Card key={label} style={{ width: '31.5%', padding: spacing.md, gap: 2, alignItems: 'center' }}>
            <Ionicons name={icon as keyof typeof Ionicons.glyphMap} size={18} color={(label === 'بانتظار الموافقة' || label === 'أعطال الأسبوع') && n ? colors.warning : colors.primary} />
            <AppText variant="h2">{n ?? '…'}</AppText>
            <AppText variant="tiny" muted center>
              {label}
            </AppText>
          </Card>
        ))}
      </View>
      <Button title="تصدير المستخدمين إلى Excel" icon="document-text" loading={busy} onPress={exportExcel} />
      {msg && (
        <AppText variant="label" center color={msg.ok ? colors.success : colors.danger}>
          {msg.text}
        </AppText>
      )}
      {!!ov?.universities.length && (
        <Card style={{ gap: 6 }}>
          <AppText variant="label">أكثر الجامعات</AppText>
          {ov.universities.map((u) => (
            <View key={u.university || '—'} style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <AppText variant="caption">{u.university || 'غير محددة'}</AppText>
              <AppText variant="caption" muted>
                {u.users}
              </AppText>
            </View>
          ))}
        </Card>
      )}

      <SectionHeader title="التحكم الطارئ" />
      {cfg && (
        <Card style={{ gap: spacing.md }}>
          <AppText variant="caption" muted>
            يصل كل المستخدمين خلال دقائق دون إصدار نسخة جديدة، ويُسجَّل في سجل الإجراءات. هذا الجوال على الإصدار {APP_VERSION}.
          </AppText>
          <View style={{ flexDirection: 'row', gap: spacing.sm }}>
            <View style={{ flex: 1 }}>
              <Field label="أقل إصدار مسموح" value={cfg.min_version} onChangeText={(v) => setCfg({ ...cfg, min_version: v })} ltr hint="الأقدم منه يُجبر على التحديث" />
            </View>
            <View style={{ flex: 1 }}>
              <Field label="أحدث إصدار" value={cfg.latest_version} onChangeText={(v) => setCfg({ ...cfg, latest_version: v })} ltr hint="الأقدم منه يُقترح عليه التحديث" />
            </View>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
            <View style={{ flex: 1 }}>
              <AppText variant="label">وضع الصيانة</AppText>
              <AppText variant="caption" muted>
                يوقف كل الميزات السحابية مؤقتاً، والباقي يعمل على الجوال.
              </AppText>
            </View>
            <Toggle accessibilityLabel="وضع الصيانة" value={cfg.maintenance} onValueChange={(v) => setCfg({ ...cfg, maintenance: v })} />
          </View>
          {cfg.maintenance && <Field label="رسالة الصيانة" value={cfg.maintenance_message} onChangeText={(v) => setCfg({ ...cfg, maintenance_message: v })} maxLength={300} placeholder="مثال: نحدّث الخادم حتى الساعة 2 ص" />}
          <AppText variant="label">إيقاف ميزة مؤقتاً</AppText>
          <ChipRow>
            {FEATURES.map((f) => (
              <Chip
                key={f.key}
                label={f.label}
                selected={cfg.disabled_features.includes(f.key)}
                onPress={() =>
                  setCfg({ ...cfg, disabled_features: cfg.disabled_features.includes(f.key) ? cfg.disabled_features.filter((x) => x !== f.key) : [...cfg.disabled_features, f.key] })
                }
              />
            ))}
          </ChipRow>
          <Field label="إعلان لكل المستخدمين (اختياري)" value={cfg.banner} onChangeText={(v) => setCfg({ ...cfg, banner: v })} maxLength={200} placeholder="يظهر أعلى الرئيسية" />
          <Segmented<'info' | 'warning'>
            value={cfg.banner_level}
            onChange={(v) => setCfg({ ...cfg, banner_level: v })}
            options={[
              { value: 'info', label: 'معلومة' },
              { value: 'warning', label: 'تنبيه' },
            ]}
          />
          <Field label="رابط التطبيق في App Store" value={cfg.ios_url} onChangeText={(v) => setCfg({ ...cfg, ios_url: v })} ltr placeholder="https://apps.apple.com/sa/app/…" />
          <Button
            title="تطبيق على كل المستخدمين"
            icon="radio-outline"
            loading={busy}
            onPress={() => {
              let clean: Omit<AppConfig, 'updated_at'>;
              try {
                clean = cleanConfig(cfg);
              } catch (e) {
                return setMsg({ ok: false, text: new CloudError((e as Error).message).message });
              }
              const lockSelf = compareVersions(APP_VERSION, clean.min_version) < 0;
              confirm(
                'تطبيق التحكم الطارئ؟',
                lockSelf
                  ? `انتبه: أقل إصدار (${clean.min_version}) أعلى من إصدار جوالك (${APP_VERSION})، فسيُطلب منك التحديث أنت أيضاً.`
                  : 'يصل كل المستخدمين عند فتح التطبيق أو خلال 15 دقيقة.',
                () =>
                  act(async () => {
                    setRemoteConfig(await cloud.adminSetAppConfig(clean));
                  }, 'طُبّق على كل المستخدمين ✓'),
                'تطبيق',
              );
            }}
          />
        </Card>
      )}

      <SectionHeader title="التقرير الشهري" />
      <Card style={{ gap: spacing.md }}>
        <Segmented<0 | -1>
          value={month}
          onChange={(m) => {
            setMonth(m);
            setReport(null);
          }}
          options={[
            { value: 0, label: monthLabel(monthKey(new Date(), 0)) },
            { value: -1, label: monthLabel(monthKey(new Date(), -1)) },
          ]}
        />
        {report ? (
          <>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
              {reportRows(report).map(([label, n]) => (
                <View key={label} style={{ width: '31%', alignItems: 'center', paddingVertical: 6 }}>
                  <AppText variant="h3">{n}</AppText>
                  <AppText variant="tiny" muted center>
                    {label}
                  </AppText>
                </View>
              ))}
              <View style={{ width: '31%', alignItems: 'center', paddingVertical: 6 }}>
                <AppText variant="h3" color={colors.primary}>
                  {activeRate(report)}%
                </AppText>
                <AppText variant="tiny" muted center>
                  نسبة النشطين
                </AppText>
              </View>
            </View>
            <Button
              title="تصدير التقرير إلى Excel"
              variant="secondary"
              icon="document-text-outline"
              onPress={() =>
                act(async () => {
                  const r = await shareCsv(`mudhaker-report-${report.month}.csv`, reportCsv(report));
                  if (!r.ok) throw new Error(r.message);
                }, 'جهّزنا ملف التقرير ✓')
              }
            />
          </>
        ) : (
          <Button
            title="عرض التقرير"
            icon="bar-chart-outline"
            loading={reportBusy}
            onPress={async () => {
              setReportBusy(true);
              try {
                setReport(await cloud.adminReport(monthKey(new Date(), month)));
                // الاطلاع يُسجَّل؛ نحدّث السجل ليظهر فوراً
                refresh();
              } catch (e) {
                setMsg({ ok: false, text: (e as Error).message });
              } finally {
                setReportBusy(false);
              }
            }}
          />
        )}
      </Card>

      <SectionHeader title="المستخدمون" />
      <Field placeholder="ابحث بالاسم أو الإيميل أو الجامعة…" value={q} onChangeText={setQ} autoCapitalize="none" />
      <ChipRow>
        {(
          [
            ['all', 'الكل'],
            ['pending', `بانتظار الموافقة${ov?.pending ? ` (${ov.pending})` : ''}`],
            ['professor', 'الدكاترة'],
            ['student', 'الطلاب'],
          ] as [Filter, string][]
        ).map(([k, l]) => (
          <Chip key={k} label={l} selected={filter === k} onPress={() => setFilter(k)} />
        ))}
      </ChipRow>
      {users.length === 0 ? (
        <AppText variant="caption" muted center>
          لا نتائج
        </AppText>
      ) : (
        users.map((u) => (
          <Card key={u.id} onPress={() => setOpen(open === u.id ? null : u.id)} accessibilityLabel={u.full_name} style={{ gap: spacing.sm }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
              <View style={{ flex: 1 }}>
                <AppText variant="h3">{u.full_name}</AppText>
                <AppText variant="caption" muted style={{ writingDirection: 'ltr', textAlign: 'right' }} numberOfLines={1}>
                  {u.email}
                </AppText>
                <AppText variant="tiny" muted>
                  {[u.university, `سجّل ${formatShortDate(new Date(u.created_at))}`].filter(Boolean).join(' · ')}
                </AppText>
              </View>
              <Pill label={u.role === 'professor' && u.status !== 'active' ? STATUS_LABEL[u.status] : ROLE_LABEL[u.role]} tone={u.status === 'pending' ? 'warning' : u.status === 'rejected' ? 'danger' : u.role === 'professor' ? 'info' : 'muted'} />
            </View>
            {(open === u.id || u.status === 'pending') && (
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                {!(u.role === 'professor' && u.status === 'active') && <Button size="sm" title="اعتماد كدكتور" icon="checkmark-circle" onPress={() => setUser(u, 'professor', 'active', 'اعتُمد كدكتور')} />}
                {u.role === 'professor' && u.status !== 'rejected' && (
                  <Button size="sm" variant="danger" title="رفض" icon="close-circle" onPress={() => confirm('رفض الحساب كدكتور؟', 'تُغلق صفحة حجزه ولا يظهر للطلاب.', () => setUser(u, 'professor', 'rejected', 'رُفض'), 'رفض')} />
                )}
                {u.role !== 'student' && <Button size="sm" variant="ghost" title="تحويل لطالب" onPress={() => setUser(u, 'student', 'active', 'صار طالباً')} />}
              </View>
            )}
          </Card>
        ))
      )}

      <SectionHeader title="استثناءات الإيميل" />
      <Card style={{ gap: spacing.md }}>
        <AppText variant="caption" muted>
          لإيميل غير جامعي (مثل حساب مراجعة Apple وGoogle) أو مشرف إضافي، أو لتثبيت دور شخص معيّن.
        </AppText>
        {rules?.overrides.map((o) => (
          <View key={o.email} style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
            <View style={{ flex: 1 }}>
              <AppText variant="label" style={{ writingDirection: 'ltr', textAlign: 'right' }}>
                {o.email}
              </AppText>
              <AppText variant="tiny" muted>
                {[o.is_admin ? 'مشرف' : null, o.role ? ROLE_LABEL[o.role] : null, o.note].filter(Boolean).join(' · ')}
              </AppText>
            </View>
            <Button size="sm" variant="ghost" title="إزالة" onPress={() => confirm('إزالة الاستثناء؟', o.email, () => act(() => cloud.adminSetOverride(o.email, null, false, ''), 'أُزيل ✓'), 'إزالة')} />
          </View>
        ))}
        <Field placeholder="الإيميل" value={ovEmail} onChangeText={setOvEmail} autoCapitalize="none" keyboardType="email-address" ltr />
        <Segmented<AccountRole | 'admin'>
          value={ovRole}
          onChange={setOvRole}
          options={[
            { value: 'student', label: 'طالب' },
            { value: 'professor', label: 'دكتور' },
            { value: 'admin', label: 'مشرف' },
          ]}
        />
        <Button
          title="إضافة استثناء"
          variant="secondary"
          icon="add"
          disabled={!/^\S+@\S+\.\S+$/.test(ovEmail.trim())}
          onPress={() => act(async () => { await cloud.adminSetOverride(ovEmail.trim(), ovRole === 'admin' ? null : ovRole, ovRole === 'admin', ''); setOvEmail(''); }, 'أُضيف ✓')}
        />
      </Card>

      <SectionHeader title="سجل الإجراءات" />
      <Card style={{ gap: spacing.sm }}>
        <AppText variant="caption" muted>
          كل اعتماد أو رفض أو تصدير أو تعديل قاعدة يُسجَّل باسم المشرف ووقته، ويُحفظ سنة.
        </AppText>
        {log.length === 0 ? (
          <AppText variant="caption" muted>
            لا إجراءات بعد
          </AppText>
        ) : (
          log.slice(0, 20).map((l, i) => (
            <View key={`${l.at}-${i}`} style={{ flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-start' }}>
              <Ionicons name="time-outline" size={14} color={colors.textMuted} style={{ marginTop: 3 }} />
              <View style={{ flex: 1 }}>
                <AppText variant="caption">
                  {actionLabel(l.action)}
                  {l.target ? ` · ${l.target}` : ''}
                </AppText>
                <AppText variant="tiny" muted>
                  {l.admin_email} · {formatShortDate(new Date(l.at))} {new Date(l.at).toTimeString().slice(0, 5)}
                </AppText>
              </View>
            </View>
          ))
        )}
      </Card>

      <SectionHeader title="الأعطال (آخر 7 أيام)" />
      <Card style={{ gap: spacing.sm }}>
        <AppText variant="caption" muted>
          بلاغات مجهولة الهوية: نص الخطأ والشاشة والإصدار فقط، مجمّعة حسب التكرار، وتُحذف بعد 30 يوماً.
        </AppText>
        {errors.length === 0 ? (
          <AppText variant="caption" muted>
            لا أعطال 🎉
          </AppText>
        ) : (
          errors.slice(0, 15).map((e, i) => (
            <View key={`${e.message}-${i}`} style={{ flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-start' }}>
              <AppText variant="label" color={colors.warning} style={{ minWidth: 28 }}>
                ×{e.count}
              </AppText>
              <View style={{ flex: 1 }}>
                <AppText variant="caption" style={{ writingDirection: 'ltr', textAlign: 'left' }}>
                  {e.message}
                </AppText>
                <AppText variant="tiny" muted>
                  {e.screen || '—'} · {e.app_version} · {formatShortDate(new Date(e.last_at))}
                </AppText>
              </View>
            </View>
          ))
        )}
      </Card>

      <SectionHeader title={`نطاقات الجامعات (${rules?.domains.length ?? 0})`} />
      <Card style={{ gap: spacing.md }}>
        <AppText variant="caption" muted>
          نطاق «منسوبين» يعتمد الدكتور تلقائياً، ونطاق «طلاب» يمنع التسجيل كدكتور. الإيميلات بنطاق غير معروف تحتاج موافقتك.
        </AppText>
        <Field placeholder="النطاق، مثال: newuni.edu.sa" value={dom} onChangeText={setDom} autoCapitalize="none" ltr />
        <Field placeholder="اسم الجامعة" value={domUni} onChangeText={setDomUni} />
        <Segmented<'staff' | 'student'>
          value={domKind}
          onChange={setDomKind}
          options={[
            { value: 'staff', label: 'منسوبون' },
            { value: 'student', label: 'طلاب' },
          ]}
        />
        <Button title="حفظ النطاق" variant="secondary" icon="globe-outline" disabled={!/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(dom.trim()) || domUni.trim().length < 2} onPress={() => act(async () => { await cloud.adminSetRule(dom.trim(), domUni.trim(), domKind); setDom(''); setDomUni(''); }, 'حُفظ النطاق ✓')} />
        {rules?.domains.map((d) => (
          <View key={d.domain} style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
            <AppText variant="caption" style={{ flex: 1 }}>
              {d.university} · {d.kind === 'staff' ? 'منسوبون' : 'طلاب'}
            </AppText>
            <AppText variant="tiny" muted style={{ writingDirection: 'ltr' }}>
              {d.domain}
            </AppText>
          </View>
        ))}
      </Card>
    </Screen>
  );
}

/** وصف عربي لرمز الإجراء في السجل. */
function actionLabel(a: string): string {
  if (a === 'export') return 'تصدير Excel';
  if (a === 'report') return 'عرض التقرير الشهري';
  if (a === 'app_config') return 'تحكم طارئ';
  if (a === 'rule_delete') return 'حذف نطاق';
  if (a.startsWith('rule:')) return 'حفظ نطاق';
  if (a === 'override_delete') return 'إزالة استثناء';
  if (a === 'override:admin') return 'إضافة مشرف';
  if (a.startsWith('override:')) return `استثناء: ${a.endsWith('professor') ? 'دكتور' : 'طالب'}`;
  if (a.startsWith('set_user:')) {
    const [role, status] = a.slice(9).split('/');
    if (role === 'student') return 'تحويل لطالب';
    return status === 'active' ? 'اعتماد دكتور' : status === 'rejected' ? 'رفض دكتور' : 'تعليق دكتور';
  }
  return a;
}
