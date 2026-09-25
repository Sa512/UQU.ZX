import type { Window } from '../officeHours';

export type PageInfo = { id: string; title: string; host_name: string; slot_minutes: number; is_open: boolean; windows: Window[]; taken: string[] };
export type Booking = { id: string; page_id: string; starts_at: string; ends_at: string; student_name: string; uni_id: string; topic: string; status: 'booked' | 'cancelled' };
export type CheckIn = { id: string; uni_id: string; student_name: string; at: string };
export type Session = { id: string; code: string; nonce: string };

/** قناة الشعبة: ما ينشره الدكتور ويقرؤه الطلاب بالرمز. */
export type ChannelSlot = { weekday: number; start_min: number; end_min: number; type: 'lecture' | 'lab'; location: string };
export type ChannelExam = { title: string; date: string; type: 'exam' | 'quiz' | 'assignment' | 'project' };
export type ChannelPost = { id: string; body: string; created_at: string };
export type ChannelInput = {
  course_name: string;
  course_code: string;
  section_code: string;
  instructor: string;
  color: string;
  slots: ChannelSlot[];
  exams: ChannelExam[];
};
export type SectionChannel = ChannelInput & { id: string; code: string; updated_at: string; posts: ChannelPost[] };

export interface CloudApi {
  /** true = خادم Supabase حقيقي، false = وضع تجريبي على هذا الجهاز. */
  readonly real: boolean;
  publishPage(p: { id?: string; title: string; host_name: string; slot_minutes: number; windows: Window[] }): Promise<{ id: string; code: string }>;
  setPageOpen(id: string, open: boolean): Promise<void>;
  getPage(code: string): Promise<PageInfo | null>;
  pageBookings(pageId: string): Promise<Booking[]>;
  book(code: string, startsAt: string, name: string, uniId: string, topic: string): Promise<string>;
  myBookings(): Promise<Booking[]>;
  cancel(id: string): Promise<void>;
  startSession(label: string): Promise<Session>;
  rotate(sessionId: string): Promise<string>;
  checkins(sessionId: string): Promise<CheckIn[]>;
  closeSession(sessionId: string): Promise<void>;
  checkIn(code: string, nonce: string, uniId: string, name: string): Promise<{ label: string }>;
  publishSection(p: ChannelInput & { id?: string }): Promise<{ id: string; code: string }>;
  getSection(code: string): Promise<SectionChannel | null>;
  postToSection(channelId: string, body: string): Promise<void>;
  deletePost(postId: string): Promise<void>;
  /** يحذف كل ما يخص هذا المستخدم على الخادم (حق الحذف في نظام حماية البيانات الشخصية). */
  deleteMyData(): Promise<void>;
}
