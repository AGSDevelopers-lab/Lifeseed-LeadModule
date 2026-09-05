import path from "node:path";
import { fileURLToPath } from "node:url";

import { PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { loadEnv } from "vite";

import { generateLeadCode } from "./prisma-lead-code-generator";
import { LeadCode } from "../domain/value-objects/LeadCode";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "../../../..");
const loaded = loadEnv("", root, "");
const DATABASE_URL = process.env.DATABASE_URL ?? loaded.DATABASE_URL;
const CITY = "KOL";
const RACE_DAY = new Date("2099-06-15T00:00:00.000Z");
const ROLLOVER_DAY = new Date("2099-06-16T00:00:00.000Z");
const CONCURRENCY = Number.parseInt(process.env.LEAD_CODE_RACE_CONCURRENCY ?? "20", 10);

function seqValues(codes: string[]): number[] {
  return codes
    .map((c) => LeadCode.parse(c).seq)
    .map((s) => Number.parseInt(s, 10))
    .sort((a, b) => a - b);
}

describe.skipIf(!DATABASE_URL)("generateLeadCode concurrency (Postgres)", () => {
  let prisma: PrismaClient;

  beforeAll(async () => {
    prisma = new PrismaClient();
    await prisma.$executeRaw`
      DELETE FROM lead_code_sequences
      WHERE city_code = ${CITY}
        AND day IN (${"2099-06-15"}::date, ${"2099-06-16"}::date)
    `;
  });

  afterAll(async () => {
    await prisma.$executeRaw`
      DELETE FROM lead_code_sequences
      WHERE city_code = ${CITY}
        AND day IN (${"2099-06-15"}::date, ${"2099-06-16"}::date)
    `;
    await prisma.$disconnect();
  });

  it(`issues ${CONCURRENCY} distinct sequential codes with no gaps under concurrency`, async () => {
    const codes = await Promise.all(
      Array.from({ length: CONCURRENCY }, () => generateLeadCode(prisma, CITY, RACE_DAY)),
    );

    const unique = new Set(codes);
    expect(unique.size).toBe(CONCURRENCY);
    expect(seqValues(codes)).toEqual(Array.from({ length: CONCURRENCY }, (_, i) => i + 1));
    for (const code of codes) {
      const parsed = LeadCode.parse(code);
      expect(parsed.cityCode).toBe(CITY);
      expect(parsed.yyyymmdd).toBe("20990615");
    }
  }, 60_000);

  it("starts a fresh sequence on day rollover", async () => {
    const nextDay = await generateLeadCode(prisma, CITY, ROLLOVER_DAY);
    const parsed = LeadCode.parse(nextDay);
    expect(parsed.yyyymmdd).toBe("20990616");
    expect(parsed.seq).toBe("0001");
  });
});
