import type { SessionAttendance } from "../enums";

export interface CounsellingSession {
  id: string;
  bookingId: string;
  leadId: string;
  counsellorUserId: string;
  startedAt: Date | null;
  endedAt: Date | null;
  attendanceStatus: SessionAttendance;
  notes: string | null;
  recordedByUserId: string;
  recordedAt: Date;
}
