import { useEffect } from 'react';
import { AppState } from 'react-native';
import { useStore } from '@/store/useStore';
import { recallPassword } from './backupKey';
import { autoBackupDue, currentPlain, fingerprint, uploadBackup } from './cloudBackup';

let running = false;

/** نسخة سحابية تلقائية بصمت: عند فتح التطبيق والعودة إليه، مرة يومياً على الأكثر وإن تغيرت البيانات. */
export async function maybeAutoBackup(now = Date.now()): Promise<boolean> {
  const s = useStore.getState();
  if (running || !s.account || !s.settings.cloudBackup) return false;
  const password = await recallPassword(s.account.id);
  const due = autoBackupDue({
    enabled: s.settings.cloudBackup,
    signedIn: true,
    hasPassword: !!password,
    hasData: s.courses.length + s.tasks.length + s.students.length + s.decks.length + s.summaries.length > 0,
    last: s.settings.lastCloudBackupAt,
    lastHash: s.settings.lastCloudBackupHash,
    hash: fingerprint(currentPlain()),
    now,
  });
  if (!due || !password) return false;
  running = true;
  try {
    await uploadBackup(password, now);
    return true;
  } catch {
    return false; // يُعاد المحاولة في المرة القادمة
  } finally {
    running = false;
  }
}

export function useCloudBackup() {
  useEffect(() => {
    // بعد استقرار التطبيق، حتى لا يبطئ الفتح
    const t = setTimeout(() => void maybeAutoBackup(), 8000);
    const sub = AppState.addEventListener('change', (st) => st === 'active' && void maybeAutoBackup());
    return () => {
      clearTimeout(t);
      sub.remove();
    };
  }, []);
}
