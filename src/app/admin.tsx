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
import { cloud, type AdminOverview, type AdminRules, type AdminUser } from '@/lib/cloud';
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

  const loadUsers = useCallback(async (query: string, f: Filter) => {
    const role = f === 'student' || f === 'professor' ? f : null;
    const status: AccountStatus | null = f === 'pending' ? 'pending' : null;
    setUsers(await cloud.adminUsers(query, role, status));
  }, []);
  const refresh = useCallback(async () => {
    try {
      const [o, r] = await Promise.all([cloud.adminOverview(), cloud.adminRules()]);
      setOv(o);
      setRules(r);
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
  ];

  return (
    <Screen back title="لوحة المشرف" subtitle="البيانات مباشرة من الخادم" right={<HeaderButton icon="refresh" label="تحديث" onPress={() => { refresh(); loadUsers(q, filter); }} />}>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
        {stats.map(([label, n, icon]) => (
          <Card key={label} style={{ width: '31.5%', padding: spacing.md, gap: 2, alignItems: 'center' }}>
            <Ionicons name={icon as keyof typeof Ionicons.glyphMap} size={18} color={label === 'بانتظار الموافقة' && n ? colors.warning : colors.primary} />
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
