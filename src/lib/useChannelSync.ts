import { useEffect } from 'react';
import { useStore } from '@/store/useStore';
import { cloud } from './cloud';
import { ensureChannelPush } from './channelPush';
import { needsSync } from './sectionChannel';

/** يحدّث قنوات الشعب في الخلفية عند فتح الرئيسية (مرة كل 20 دقيقة لكل مادة كحد أقصى). */
export function useChannelSync() {
  useEffect(() => {
    let cancelled = false;
    Promise.resolve().then(async () => {
      const now = Date.now();
      for (const c of useStore.getState().courses.filter((x) => needsSync(x, now))) {
        if (cancelled) return;
        try {
          const ch = await cloud.getSection(c.channel!.code);
          if (ch && !cancelled) useStore.getState().applyChannel(ch);
        } catch {
          // بلا إنترنت: نحاول في المرة القادمة
        }
      }
      // تسجيل إشعارات القنوات التي لم تُسجَّل بعد (مثلاً بعد السماح بالإشعارات لاحقاً)
      for (const c of useStore.getState().courses.filter((x) => x.channel && !x.channel.pushed)) {
        if (cancelled) return;
        await ensureChannelPush(c);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);
}
