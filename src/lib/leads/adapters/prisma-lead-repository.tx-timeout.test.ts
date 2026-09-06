import { describe, expect, it, vi } from "vitest";

const { $transaction } = vi.hoisted(() => ({
  $transaction: vi.fn(
    async (
      fn: (tx: unknown) => Promise<unknown>,
      _opts?: { maxWait: number; timeout: number },
    ) => fn({}),
  ),
}));

vi.mock("@/lib/db", () => ({
  prisma: { $transaction },
}));
vi.mock("@/lib/audit", () => ({
  audit: { log: vi.fn(async () => undefined) },
}));

import { aLead } from "../testing/fixtures/aLead";
import { LeadStatus } from "../domain/enums";
import {
  LEAD_INTERACTIVE_TX_OPTIONS,
  runLeadWriteTransaction,
} from "./prisma-lead-repository";
import { PrismaLeadTransitionStore } from "./prisma-transition-store";

describe("B04.5 interactive transaction timeouts", () => {
  it("exports maxWait 10s and timeout 20s", () => {
    expect(LEAD_INTERACTIVE_TX_OPTIONS).toEqual({
      maxWait: 10_000,
      timeout: 20_000,
    });
  });

  it("runLeadWriteTransaction passes options to prisma.$transaction", async () => {
    $transaction.mockClear();
    await runLeadWriteTransaction(async () => "ok");
    expect($transaction).toHaveBeenCalledTimes(1);
    expect($transaction.mock.calls[0]?.[1]).toEqual(LEAD_INTERACTIVE_TX_OPTIONS);
  });

  it("persistBundle (used by apply-transition) passes the same options", async () => {
    const captured: unknown[] = [];
    const db = {
      $transaction: vi.fn(async (_fn: unknown, opts?: unknown) => {
        captured.push(opts);
        return {
          status: LeadStatus.ASSIGNED,
          latestHistoryToStatus: LeadStatus.ASSIGNED,
        };
      }),
    };
    const store = new PrismaLeadTransitionStore(db as never);
    await store.persistBundle({
      lead: aLead({ status: LeadStatus.NEW }),
      nextStatus: LeadStatus.ASSIGNED,
      writes: [],
      actorUserId: "u1",
      actorRole: "OPS_MANAGER",
      now: new Date("2026-09-04T12:00:00.000Z"),
    });
    expect(captured[0]).toEqual(LEAD_INTERACTIVE_TX_OPTIONS);
  });
});
