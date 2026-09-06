import type { CounsellingSession } from "../../domain/entities/CounsellingSession";
import type { SessionAttendance } from "../../domain/enums";

export type PrismaCounsellingSessionRow = {
  id: string;
  bookingId: string;
  leadId: string;
  counsellorUserId: string;
  startedAt: Date | null;
  endedAt: Date | null;
  attendanceStatus: string;
  notes: string | null;
  recordedByUserId: string;
  recordedAt: Date;
};

export function counsellingSessionToDomain(
  row: PrismaCounsellingSessionRow,
): CounsellingSession {
  return {
    id: row.id,
    bookingId: row.bookingId,
    leadId: row.leadId,
    counsellorUserId: row.counsellorUserId,
    startedAt: row.startedAt,
    endedAt: row.endedAt,
    attendanceStatus: row.attendanceStatus as SessionAttendance,
    notes: row.notes,
    recordedByUserId: row.recordedByUserId,
    recordedAt: row.recordedAt,
  };
}

export function counsellingSessionToPrisma(
  entity: CounsellingSession,
): PrismaCounsellingSessionRow {
  return { ...entity };
}

export const toDomain = counsellingSessionToDomain;
export const toPrisma = counsellingSessionToPrisma;
