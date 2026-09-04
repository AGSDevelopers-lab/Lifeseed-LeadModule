import type { BookingStatus } from "../enums";

export interface CounsellingBooking {
  id: string;
  leadId: string;
  counsellorUserId: string;
  mode: string;
  slotStart: Date;
  durationMin: number;
  bookingStatus: BookingStatus;
  rescheduledFromBookingId: string | null;
  cancelledReason: string | null;
  cancelledByUserId: string | null;
  cancelledAt: Date | null;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
}
