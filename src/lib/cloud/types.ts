import type { Window } from '../officeHours';

export type PageInfo = { id: string; title: string; host_name: string; slot_minutes: number; is_open: boolean; windows: Window[]; taken: string[] };
export type Booking = { id: string; page_id: string; starts_at: string; ends_at: string; student_name: string; uni_id: string; topic: string; status: 'booked' | 'cancelled' };
export type CheckIn = { id: string; uni_id: string; student_name: string; at: string };
export type Session = { id: string; code: string; nonce: string };

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
}
