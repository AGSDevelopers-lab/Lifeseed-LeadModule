import type { CounsellingBooking } from "../../domain/entities/CounsellingBooking";
import type { BookingStatus } from "../../domain/enums";

export type PrismaCounsellingBookingRow = {
  id: string;
  leadId: string;
  counsellorUserId: string;
  mode: string;
  scheduledAt: Date;
  durationMinutes: number;
  bookingStatus: string;
  rescheduledFromBookingId: string | null;
  cancelledReason: string | null;
  cancelledByUserId: string | null;
  cancelledAt: Date | null;
  followupNotes: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export function counsellingBookingToDomain(
  row: PrismaCounsellingBookingRow,
): CounsellingBooking {
  return {
    id: row.id,
    leadId: row.leadId,
    counsellorUserId: row.counsellorUserId,
    mode: row.mode,
    slotStart: row.scheduledAt,
    durationMin: row.durationMinutes,
    bookingStatus: row.bookingStatus as BookingStatus,
    rescheduledFromBookingId: row.rescheduledFromBookingId,
    cancelledReason: row.cancelledReason,
    cancelledByUserId: row.cancelledByUserId,
    cancelledAt: row.cancelledAt,
    notes: row.followupNotes,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export function counsellingBookingToPrisma(
  entity: CounsellingBooking,
): PrismaCounsellingBookingRow {
  return {
    id: entity.id,
    leadId: entity.leadId,
    counsellorUserId: entity.counsellorUserId,
    mode: entity.mode,
    scheduledAt: entity.slotStart,
    durationMinutes: entity.durationMin,
    bookingStatus: entity.bookingStatus,
    rescheduledFromBookingId: entity.rescheduledFromBookingId,
    cancelledReason: entity.cancelledReason,
    cancelledByUserId: entity.cancelledByUserId,
    cancelledAt: entity.cancelledAt,
    followupNotes: entity.notes,
    createdAt: entity.createdAt,
    updatedAt: entity.updatedAt,
  };
}

export const toDomain = counsellingBookingToDomain;
export const toPrisma = counsellingBookingToPrisma;
