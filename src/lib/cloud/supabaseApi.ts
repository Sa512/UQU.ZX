/** التنفيذ الحقيقي على Supabase (تسجيل دخول مجهول + دوال RPC محمية). */
import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { AppState, Platform } from 'react-native';
import { toCloudError } from './errors';
import { sanitizeChannel } from '../sectionChannel';
import type { Booking, CheckIn, CloudApi, PageInfo, Session } from './types';

export function createSupabaseApi(url: string, anonKey: string): CloudApi {
  const sb: SupabaseClient = createClient(url, anonKey, {
    auth: { storage: AsyncStorage, autoRefreshToken: true, persistSession: true, detectSessionInUrl: false },
  });
  if (Platform.OS !== 'web') {
    AppState.addEventListener('change', (s) => (s === 'active' ? sb.auth.startAutoRefresh() : sb.auth.stopAutoRefresh()));
  }

  let authPromise: Promise<void> | null = null;
  const ensureAuth = () =>
    (authPromise ??= (async () => {
      const { data } = await sb.auth.getSession();
      if (data.session) return;
      const { error } = await sb.auth.signInAnonymously();
      if (error) throw error;
    })().catch((e) => {
      authPromise = null;
      throw e;
    }));

  const call = async <T>(fn: () => PromiseLike<{ data: T; error: unknown }>): Promise<T> => {
    try {
      await ensureAuth();
      const { data, error } = await fn();
      if (error) throw error;
      return data;
    } catch (e) {
      throw toCloudError(e);
    }
  };

  return {
    real: true,
    async publishPage({ id, title, host_name, slot_minutes, windows }) {
      const page = await call(() =>
        id
          ? sb.from('office_hours_pages').update({ title, host_name, slot_minutes }).eq('id', id).select('id, code').single()
          : sb.from('office_hours_pages').insert({ title, host_name, slot_minutes }).select('id, code').single(),
      );
      const p = page as { id: string; code: string };
      await call(() => sb.from('office_hours_windows').delete().eq('page_id', p.id));
      if (windows.length) await call(() => sb.from('office_hours_windows').insert(windows.map((w) => ({ ...w, page_id: p.id }))));
      return p;
    },
    async setPageOpen(id, open) {
      await call(() => sb.from('office_hours_pages').update({ is_open: open }).eq('id', id));
    },
    async getPage(code) {
      return (await call(() => sb.rpc('get_office_hours', { p_code: code }))) as PageInfo | null;
    },
    async pageBookings(pageId) {
      return (await call(() => sb.from('bookings').select('*').eq('page_id', pageId).eq('status', 'booked').gte('starts_at', new Date().toISOString()).order('starts_at'))) as Booking[];
    },
    async book(code, startsAt, name, uniId, topic) {
      const r = (await call(() => sb.rpc('book_office_hour', { p_code: code, p_starts_at: startsAt, p_name: name, p_uni_id: uniId, p_topic: topic }))) as { id?: string; error?: string };
      if (r.error || !r.id) throw toCloudError(r.error ?? 'unknown');
      return r.id;
    },
    async myBookings() {
      const { data: u } = await sb.auth.getUser();
      return (await call(() => sb.from('bookings').select('*').eq('student', u.user?.id ?? '').order('starts_at'))) as Booking[];
    },
    async cancel(id) {
      await call(() => sb.rpc('cancel_booking', { p_id: id }));
    },
    async startSession(label) {
      return (await call(() => sb.from('attendance_sessions').insert({ label }).select('id, code, nonce').single())) as Session;
    },
    async rotate(sessionId) {
      return (await call(() => sb.rpc('rotate_nonce', { p_session: sessionId }))) as string;
    },
    async checkins(sessionId) {
      return (await call(() => sb.from('checkins').select('id, uni_id, student_name, at').eq('session_id', sessionId).order('at'))) as CheckIn[];
    },
    async closeSession(sessionId) {
      await call(() => sb.from('attendance_sessions').update({ is_open: false }).eq('id', sessionId));
    },
    async checkIn(code, nonce, uniId, name) {
      // الخادم يعيد الأخطاء قيمةً {error} حتى تبقى المحاولة الفاشلة محسوبة في حد الطلبات
      const r = (await call(() => sb.rpc('check_in', { p_code: code, p_nonce: nonce, p_uni_id: uniId, p_name: name }))) as { label?: string; error?: string };
      if (r.error || !r.label) throw toCloudError(r.error ?? 'unknown');
      return { label: r.label };
    },
    async publishSection({ id, ...input }) {
      return (await call(() =>
        id
          ? sb.from('section_channels').update(input).eq('id', id).select('id, code').single()
          : sb.from('section_channels').insert(input).select('id, code').single(),
      )) as { id: string; code: string };
    },
    async getSection(code) {
      return sanitizeChannel(await call(() => sb.rpc('get_section', { p_code: code })));
    },
    async postToSection(channelId, body) {
      await call(() => sb.from('section_posts').insert({ channel_id: channelId, body: body.trim() }));
    },
    async deletePost(postId) {
      await call(() => sb.from('section_posts').delete().eq('id', postId));
    },
    async deleteMyData() {
      await call(() => sb.rpc('delete_my_data'));
    },
    async subscribeChannel(code, token) {
      const r = (await call(() => sb.rpc('subscribe_channel', { p_code: code, p_token: token }))) as { ok?: boolean; error?: string };
      if (r.error) throw toCloudError(r.error);
    },
    async unsubscribeChannel(code, token) {
      await call(() => sb.rpc('unsubscribe_channel', { p_code: code, p_token: token }));
    },
  };
}
