/**
 * One-time idempotent seed of LeadConfig v1 defaults.
 * Instantiates PrismaClient directly (src/lib/db.ts is server-only).
 *
 * SoD: author and approver must be distinct (DB check constraint).
 * Author = LEAD_SYSTEM_USER_ID or first BANK_SUPER_ADMIN.
 * Approver = LEAD_CONFIG_APPROVER_USER_ID or another BANK_SUPER_ADMIN / OPS_MANAGER.
 */
import { PrismaClient } from "@prisma/client";

import { seedLeadConfigDefaults } from "../src/lib/leads/application/seed-lead-config-defaults";

async function main() {
  const prisma = new PrismaClient();
  try {
    const summary = await seedLeadConfigDefaults(prisma as never);
    console.log(JSON.stringify({ ok: true, ...summary }));
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
