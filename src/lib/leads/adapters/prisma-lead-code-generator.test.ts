import { afterEach, describe, expect, it, vi } from "vitest";

import {
  allocateLeadCode,
  generateLeadCode,
  isLeadCodeV2Enabled,
  type LeadCodeCountClient,
} from "./prisma-lead-code-generator";
import { generateLeadCode as generateLegacyLeadCode } from "../lead-code-generator";

const envSnapshot = { ...process.env };

afterEach(() => {
  process.env = { ...envSnapshot };
  vi.restoreAllMocks();
});

describe("isLeadCodeV2Enabled", () => {
  it("defaults to off when unset", () => {
    delete process.env.LEAD_CODE_V2_ENABLED;
    expect(isLeadCodeV2Enabled()).toBe(false);
  });

  it("is off for the explicit off value", () => {
    expect(isLeadCodeV2Enabled({ LEAD_CODE_V2_ENABLED: "off" })).toBe(false);
  });

  it("is on only for the exact on value", () => {
    expect(isLeadCodeV2Enabled({ LEAD_CODE_V2_ENABLED: "on" })).toBe(true);
    expect(isLeadCodeV2Enabled({ LEAD_CODE_V2_ENABLED: "ON" })).toBe(false);
  });
});

describe("generateLeadCode (v2 adapter)", () => {
  it("calls next_lead_code with uppercased city and UTC date", async () => {
    const captured: unknown[] = [];
    const prisma = {
      $queryRaw: vi.fn(async (strings: TemplateStringsArray, ...values: unknown[]) => {
        captured.push({ sql: strings.join("?"), values });
        return [{ code: "LED-KOL-20260905-0001" }];
      }),
    };

    const day = new Date("2026-09-05T18:30:00.000Z");
    const code = await generateLeadCode(prisma, "kol", day);

    expect(code).toBe("LED-KOL-20260905-0001");
    expect(captured).toEqual([
      { sql: "\n    SELECT next_lead_code(?::text, ?::date)::text AS code\n  ", values: ["KOL", "2026-09-05"] },
    ]);
  });
});

describe("allocateLeadCode flag routing", () => {
  const capturedAt = new Date("2026-09-05T08:00:00.000Z");

  it("uses the legacy count+1 generator when the flag is off", async () => {
    process.env.LEAD_CODE_V2_ENABLED = "off";
    const prisma: LeadCodeCountClient = {
      $queryRaw: vi.fn(async () => {
        throw new Error("v2 SQL must not run when flag is off");
      }),
      lead: {
        count: vi.fn(async () => 4),
      },
    };

    const code = await allocateLeadCode(prisma, "Kolkata", capturedAt);
    expect(code).toBe(generateLegacyLeadCode("Kolkata", capturedAt, 5));
    expect(prisma.lead.count).toHaveBeenCalledWith({
      where: { leadCode: { startsWith: "LED-KOL-20260905-" } },
    });
    expect(prisma.$queryRaw).not.toHaveBeenCalled();
  });

  it("uses next_lead_code when the flag is on", async () => {
    process.env.LEAD_CODE_V2_ENABLED = "on";
    const prisma: LeadCodeCountClient = {
      $queryRaw: vi.fn(async () => [{ code: "LED-KOL-20260905-0001" }]),
      lead: {
        count: vi.fn(async () => {
          throw new Error("legacy count must not run when flag is on");
        }),
      },
    };

    const code = await allocateLeadCode(prisma, "Kolkata", capturedAt);
    expect(code).toBe("LED-KOL-20260905-0001");
    expect(prisma.lead.count).not.toHaveBeenCalled();
  });
});

describe("legacy generateLeadCode", () => {
  it("still formats LED-{CITY}-{YYYYMMDD}-{XXXX}", () => {
    const day = new Date("2026-09-05T00:00:00.000Z");
    expect(generateLegacyLeadCode("Hyderabad", day, 12)).toBe("LED-HYD-20260905-0012");
  });
});
