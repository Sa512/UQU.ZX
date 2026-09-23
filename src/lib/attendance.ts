/** إحصاءات حضور الطلاب لعضو هيئة التدريس (نفس قاعدة الحرمان 25%). */
import { absenceStatus, type AbsenceStatus } from './absence';

export type AttendanceRecord = { id: string; sectionId: string; date: string; absent: string[] };

export type StudentAttendance = { studentId: string; absences: number; status: AbsenceStatus };

export function studentAttendance(
  studentIds: string[],
  records: AttendanceRecord[],
  weeklyMeetings: number,
  weeks: number,
): StudentAttendance[] {
  const counts = new Map<string, number>(studentIds.map((id) => [id, 0]));
  for (const r of records) for (const id of r.absent) if (counts.has(id)) counts.set(id, counts.get(id)! + 1);
  return studentIds.map((id) => ({ studentId: id, absences: counts.get(id)!, status: absenceStatus(counts.get(id)!, weeklyMeetings, weeks) }));
}
