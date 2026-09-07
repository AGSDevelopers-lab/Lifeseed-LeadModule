/**
 * Backfill LeadConversion rows for leads that already have convertedDonorId /
 * convertedRecipientId. Instantiates PrismaClient directly so this can run
 * under `npx tsx` (src/lib/db.ts is server-only).
 */
import { PrismaClient } from "@prisma/client";

import { backfillLeadConversions } from "../src/lib/leads/application/backfill-lead-conversions";

async function main() {
  const prisma = new PrismaClient();
  try {
    const summary = await backfillLeadConversions(prisma as never);
    console.log(`Backfilled ${summary.inserted} leads`);
    console.log(JSON.stringify({ ok: true, ...summary }));
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
