/**
 * نقطة الدخول للخدمات السحابية. تتفعّل تلقائياً بوضع:
 *   EXPO_PUBLIC_SUPABASE_URL و EXPO_PUBLIC_SUPABASE_ANON_KEY
 * وبدونها تعمل بالوضع التجريبي على الجهاز.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createDemoApi } from './demoApi';
import { createSupabaseApi } from './supabaseApi';
import type { CloudApi } from './types';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const key = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

export const cloud: CloudApi = url && key ? createSupabaseApi(url, key) : createDemoApi(Date.now, 'this-device', AsyncStorage);
export * from './errors';
export * from './types';
