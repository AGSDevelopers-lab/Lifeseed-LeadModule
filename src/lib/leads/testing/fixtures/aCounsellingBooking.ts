import { BookingStatus } from "../../domain/enums";
import type { CounsellingBooking } from "../../domain/entities/CounsellingBooking";

export function aCounsellingBooking(
  overrides: Partial<CounsellingBooking> = {},
): CounsellingBooking {
  return {
    id: "book_1",
    leadId: "lead_1",
    counsellorUserId: "user_c",
    mode: "VIDEO_CALL",
    slotStart: new Date("2026-09-05T10:00:00.000Z"),
    durationMin: 30,
    bookingStatus: BookingStatus.SCHEDULED,
    rescheduledFromBookingId: null,
    cancelledReason: null,
    cancelledByUserId: null,
    cancelledAt: null,
    notes: null,
    createdAt: new Date("2026-09-04T12:00:00.000Z"),
    updatedAt: new Date("2026-09-04T12:00:00.000Z"),
    ...overrides,
  };
}
