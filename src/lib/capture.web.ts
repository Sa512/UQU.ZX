import type { RefObject } from 'react';
import type { View } from 'react-native';

/** الويب: المعاينة متاحة، والحفظ في الصور من تطبيق الجوال. */
export const captureSupported = false;
export const saveWallpaper = async (_ref: RefObject<View | null>): Promise<{ ok: boolean; message: string }> => ({ ok: false, message: 'الحفظ في الصور متاح في تطبيق الجوال.' });
export const shareCardImage = async (_ref: RefObject<View | null>): Promise<{ ok: boolean; message?: string }> => ({ ok: false, message: 'المشاركة كصورة متاحة في تطبيق الجوال.' });
