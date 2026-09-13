import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/rbac", () => ({
  requirePermission: vi.fn(async () => ({ userId: "u1", roles: ["TELECALLER"], siteId: "s1" })),
}));
vi.mock("@/lib/leads/adapters/identity-adapter", () => ({
  resolveLeadActor: vi.fn(async () => ({ userId: "u1", roles: ["TELECALLER"], siteId: "s1" })),
}));
vi.mock("@/lib/leads/adapters/prisma-lead-repository", () => ({
  assertLeadReadable: vi.fn(async () => ({ id: "lead-1" })),
}));
vi.mock("@/lib/leads/application/counselling", () => ({
  bookCounsellingSession: vi.fn(async () => ({ result: { id: "T-15" } })),
  rescheduleCounsellingBooking: vi.fn(async () => ({ result: { id: "T-19" } })),
  cancelCounsellingBooking: vi.fn(async () => ({ result: { id: "T-19" } })),
  recordCounsellingSession: vi.fn(async () => ({ result: { id: "T-17" } })),
  recordCounsellingOutcome: vi.fn(async () => ({ result: { id: "T-23" } })),
}));
vi.mock("@/lib/leads/adapters/prisma-counselling", () => ({
  loadCounsellingBookingById: vi.fn(async () => ({
    booking: {
      id: "b1",
      leadId: "lead-1",
      counsellorUserId: "c1",
      mode: "VIDEO_CALL",
      bookingStatus: "SCHEDULED",
    },
    lead: { id: "lead-1", leadCode: "LED-1" },
    sessions: [],
  })),
  listCounsellingCalendar: vi.fn(async () => []),
}));
vi.mock("@/lib/leads/application/convert-http", () => ({
  handleConvertRecipient: vi.fn(async () => new Response(JSON.stringify({ ok: true }), { status: 200 })),
}));

import { POST as bookPost } from "@/app/api/leads/v2/leads/[id]/counselling/bookings/route";
import { GET as getBooking } from "@/app/api/leads/v2/counselling/bookings/[id]/route";
import { PATCH as reschedulePatch } from "@/app/api/leads/v2/counselling/bookings/[id]/reschedule/route";
import { PATCH as cancelPatch } from "@/app/api/leads/v2/counselling/bookings/[id]/cancel/route";
import { requirePermission } from "@/lib/rbac";
import { bookCounsellingSession, rescheduleCounsellingBooking, cancelCounsellingBooking } from "@/lib/leads/application/counselling";

describe("B11 counselling HTTP", () => {
  beforeEach(() => {
    vi.mocked(requirePermission).mockClear();
  });

  it("POST book requires counselling.book", async () => {
    const res = await bookPost(
      new Request("http://localhost/api/leads/v2/leads/lead-1/counselling/bookings", {
        method: "POST",
        body: JSON.stringify({
          counsellorUserId: "c1",
          scheduledAt: "2026-09-20T10:00:00.000Z",
        }),
      }),
      { params: Promise.resolve({ id: "lead-1" }) },
    );
    expect(requirePermission).toHaveBeenCalledWith("counselling.book");
    expect(bookCounsellingSession).toHaveBeenCalled();
    expect(res.status).toBe(200);
  });

  it("GET booking requires counselling.view", async () => {
    const res = await getBooking(new Request("http://localhost/x"), {
      params: Promise.resolve({ id: "b1" }),
    });
    expect(requirePermission).toHaveBeenCalledWith("counselling.view");
    expect(res.status).toBe(200);
  });

  it("PATCH reschedule uses counselling.reschedule not session.cancel", async () => {
    const res = await reschedulePatch(
      new Request("http://localhost/x", {
        method: "PATCH",
        body: JSON.stringify({ scheduledAt: "2026-09-22T10:00:00.000Z" }),
      }),
      { params: Promise.resolve({ id: "b1" }) },
    );
    expect(requirePermission).toHaveBeenCalledWith("counselling.reschedule");
    expect(rescheduleCounsellingBooking).toHaveBeenCalled();
    expect(res.status).toBe(200);
  });

  it("PATCH cancel uses counselling.cancel", async () => {
    const res = await cancelPatch(
      new Request("http://localhost/x", {
        method: "PATCH",
        body: JSON.stringify({ reason: "cannot attend" }),
      }),
      { params: Promise.resolve({ id: "b1" }) },
    );
    expect(requirePermission).toHaveBeenCalledWith("counselling.cancel");
    expect(cancelCounsellingBooking).toHaveBeenCalled();
    expect(res.status).toBe(200);
  });
});
