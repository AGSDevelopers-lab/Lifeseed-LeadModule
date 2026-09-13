/**
 * One-time manual backfill: LeadAttribution FIRST-touch from Lead.source only.
 * Do not attach to migrations or deploy hooks. Running this script is not authorized by B15 dispatch.
 */
import { PrismaClient } from "@prisma/client";

import { backfillLeadAttribution } from "../src/lib/leads/application/backfill-lead-attribution";

async function main() {
  const prisma = new PrismaClient();
  try {
    const summary = await backfillLeadAttribution(prisma);
    console.log(JSON.stringify({ ok: true, ...summary }));
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
