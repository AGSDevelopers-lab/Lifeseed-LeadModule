/**
 * One-time idempotent explode of legacy LeadDoNotCall phone/email pairs.
 * Instantiates PrismaClient directly (src/lib/db.ts is server-only).
 */
import { PrismaClient } from "@prisma/client";

import { migrateDncToV2 } from "../src/lib/leads/application/migrate-dnc-to-v2";

async function main() {
  const prisma = new PrismaClient();
  try {
    const summary = await migrateDncToV2(prisma as never);
    console.log(JSON.stringify({ ok: true, ...summary }));
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
