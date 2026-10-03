import { useEffect, useState } from 'react';
import { cloud, type BackupInfo } from './cloud';

/** معلومات النسخة السحابية لهذا الحساب (null = لا توجد، undefined = لم تُعرف بعد). */
export function useBackupInfo(enabled: boolean, refreshKey = 0): BackupInfo | null | undefined {
  const [info, setInfo] = useState<BackupInfo | null | undefined>(undefined);
  useEffect(() => {
    if (!enabled) return;
    let alive = true;
    cloud
      .backupInfo()
      .then((i) => alive && setInfo(i))
      .catch(() => alive && setInfo(null));
    return () => {
      alive = false;
    };
  }, [enabled, refreshKey]);
  return enabled ? info : undefined;
}

const DEVICE_AR: Record<string, string> = { iPhone: 'آيفون', iPad: 'آيباد', Android: 'أندرويد', web: 'المتصفح' };

/** «3 أكتوبر · 9:15 م · آيباد · 42 ك.ب» */
export function backupLabel(i: BackupInfo): string {
  const d = new Date(i.updated_at);
  const h = d.getHours();
  const date = d.toLocaleDateString('ar-SA-u-ca-gregory-nu-latn', { day: 'numeric', month: 'long' });
  const time = `${h % 12 || 12}:${String(d.getMinutes()).padStart(2, '0')} ${h < 12 ? 'ص' : 'م'}`;
  const size = i.size >= 1_000_000 ? `${(i.size / 1_000_000).toFixed(1)} م.ب` : `${Math.max(1, Math.round(i.size / 1000))} ك.ب`;
  return [date, time, DEVICE_AR[i.device], size].filter(Boolean).join(' · ');
}
