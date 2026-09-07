import { describe, expect, it } from "vitest";

import { DncChannel, DncSource } from "../domain/enums";
import { toLegacyDoNotCallListRow } from "../adapters/mappers/dnc-mapper";
import { migrateDncToV2 } from "./migrate-dnc-to-v2";

describe("migrateDncToV2", () => {
  it("is idempotent — second run inserts zero email rows", async () => {
    const created: string[] = [];
    const rows: Array<{
      id: string;
      phone: string;
      email: string | null;
      reason: string;
      source: string;
      addedByUserId: string | null;
      addedAt: Date;
      expiresAt: Date | null;
      channel: string;
      normalisedValue: string;
      createdByUserId: string;
      createdAt: Date;
      updatedAt: Date;
      removedAt: Date | null;
    }> = [
      {
        id: "d1",
        phone: "9876543210",
        email: "Ada@LifeSeed.in",
        reason: "manual",
        source: DncSource.OPS_ADD,
        addedByUserId: null,
        addedAt: new Date("2026-01-01T00:00:00.000Z"),
        expiresAt: null,
        channel: DncChannel.PHONE,
        normalisedValue: "9876543210",
        createdByUserId: "SYSTEM",
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
        updatedAt: new Date("2026-01-01T00:00:00.000Z"),
        removedAt: null,
      },
    ];
    const db = {
      leadDoNotCall: {
        findMany: async () => rows,
        create: async (args: { data: { normalisedValue: string; channel: string } }) => {
          created.push(args.data.normalisedValue);
          rows.push({
            ...rows[0],
            id: `email-${args.data.normalisedValue}`,
            channel: DncChannel.EMAIL,
            normalisedValue: args.data.normalisedValue,
            email: args.data.normalisedValue,
          });
          return { id: `email-${args.data.normalisedValue}` };
        },
        update: async () => ({ id: "d1" }),
      },
    };

    const first = await migrateDncToV2(db as never);
    const second = await migrateDncToV2(db as never);
    expect(first.emailsInserted).toBe(1);
    expect(second.emailsInserted).toBe(0);
    expect(created).toEqual(["ada@lifeseed.in"]);
  });

  it("legacy LeadDoNotCallList view projection keeps id/phone/email/timestamps", () => {
    const now = new Date("2026-01-02T00:00:00.000Z");
    expect(
      toLegacyDoNotCallListRow({
        id: "d1",
        phone: "9876543210",
        email: "ada@lifeseed.in",
        createdAt: now,
        updatedAt: now,
      }),
    ).toEqual({
      id: "d1",
      phone: "9876543210",
      email: "ada@lifeseed.in",
      createdAt: now,
      updatedAt: now,
    });
  });
});
