/**
 * Manual concurrency check for B03.
 * Usage: npx tsx scripts/lead-code-race-test.ts [CITY] [YYYY-MM-DD]
 * Default: KOL + today (UTC). Prefer a far-future date against shared DBs.
 */
import { PrismaClient } from "@prisma/client";

import { generateLeadCode } from "../src/lib/leads/adapters/prisma-lead-code-generator";
import { LeadCode } from "../src/lib/leads/domain/value-objects/LeadCode";

async function main() {
  const city = (process.argv[2] ?? "KOL").trim().toUpperCase();
  const dayIso = process.argv[3] ?? new Date().toISOString().slice(0, 10);
  const day = new Date(`${dayIso}T00:00:00.000Z`);
  const prisma = new PrismaClient();

  try {
    const codes = await Promise.all(
      Array.from({ length: 100 }, () => generateLeadCode(prisma, city, day)),
    );
    const unique = new Set(codes);
    const seqs = codes
      .map((c) => Number.parseInt(LeadCode.parse(c).seq, 10))
      .sort((a, b) => a - b);
    const min = seqs[0];
    const max = seqs[seqs.length - 1];
    const expected = Array.from({ length: 100 }, (_, i) => min + i);
    const noGaps = seqs.every((n, i) => n === expected[i]);

    console.log(
      JSON.stringify(
        {
          city,
          day: dayIso,
          count: codes.length,
          unique: unique.size,
          min,
          max,
          noGaps,
          sample: codes.slice(0, 5),
        },
        null,
        2,
      ),
    );

    if (unique.size !== 100 || !noGaps) {
      process.exitCode = 1;
    }
  } finally {
    await prisma.$disconnect();
  }
}

void main();
