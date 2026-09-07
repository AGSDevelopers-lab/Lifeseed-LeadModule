import { describe, expect, it, vi } from "vitest";

import { ConversionTarget } from "@prisma/client";

import { backfillLeadConversions } from "./backfill-lead-conversions";

describe("backfillLeadConversions", () => {
  it("is idempotent — second run inserts zero rows", async () => {
    const created: string[] = [];
    const conversions = new Map<string, { id: string }>();
    const db = {
      user: { findFirst: vi.fn(async () => ({ id: "sys" })) },
      lead: {
        findMany: vi.fn(async () => [
          {
            id: "lead_a",
            convertedDonorId: "donor_1",
            convertedRecipientId: null,
            convertedAt: new Date("2026-01-01T00:00:00.000Z"),
            assignedTelecallerId: "tc_1",
          },
        ]),
      },
      leadConversion: {
        findUnique: vi.fn(async ({ where }: { where: { leadId: string } }) =>
          conversions.get(where.leadId) ?? null,
        ),
        create: vi.fn(async (args: object) => {
          const data = (args as { data: { leadId: string; notes: string; targetType: ConversionTarget } }).data;
          conversions.set(data.leadId, { id: `conv-${data.leadId}` });
          created.push(data.leadId);
          expect(data.notes).toBe("v2.1_backfill");
          expect(data.targetType).toBe(ConversionTarget.DONOR);
          return { id: `conv-${data.leadId}` };
        }),
      },
    };

    const first = await backfillLeadConversions(db, { LEAD_SYSTEM_USER_ID: "sys" });
    const second = await backfillLeadConversions(db, { LEAD_SYSTEM_USER_ID: "sys" });
    expect(first).toEqual({ scanned: 1, inserted: 1 });
    expect(second).toEqual({ scanned: 1, inserted: 0 });
    expect(created).toEqual(["lead_a"]);
  });
});
