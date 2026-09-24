import { Asset, requestPermissionsAsync } from 'expo-media-library';
import type { RefObject } from 'react';
import type { View } from 'react-native';
import { captureRef } from 'react-native-view-shot';
import { shareImage } from './exportIO';

export const captureSupported = true;

/** يلتقط الخلفية بدقة شاشة iPhone الكبيرة ويحفظها في الصور (أو يفتح المشاركة إن رُفض الإذن). */
export async function saveWallpaper(ref: RefObject<View | null>): Promise<{ ok: boolean; message: string }> {
  try {
    const uri = await captureRef(ref, { format: 'png', quality: 1, width: 1290, height: 2796, result: 'tmpfile' });
    const perm = await requestPermissionsAsync(true);
    if (perm.granted) {
      await Asset.create(uri);
      return { ok: true, message: 'حُفظت الخلفية في الصور ✓ عيّنها من الإعدادات ← الخلفية.' };
    }
    const r = await shareImage(uri);
    return { ok: r.ok, message: r.ok ? 'اختر «حفظ الصورة» من نافذة المشاركة.' : (r.message ?? 'تعذّر الحفظ.') };
  } catch {
    return { ok: false, message: 'تعذّر إنشاء الصورة.' };
  }
}

/** يلتقط بطاقة الستوري بدقة 1080×1920 ويفتح نافذة المشاركة (سناب، إنستقرام، واتساب…). */
export async function shareCardImage(ref: RefObject<View | null>): Promise<{ ok: boolean; message?: string }> {
  try {
    const uri = await captureRef(ref, { format: 'png', quality: 1, width: 1080, height: 1920, result: 'tmpfile' });
    return await shareImage(uri, 'مشاركة');
  } catch {
    return { ok: false, message: 'تعذّر إنشاء الصورة.' };
  }
}
