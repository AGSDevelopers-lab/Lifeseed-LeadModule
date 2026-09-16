/**
 * Structural B12 template seed — inactive, unapproved, {{body}} only.
 */
import { PrismaClient } from "@prisma/client";

import { seedB12NotificationTemplateStructure } from "../src/lib/leads/application/seed-notification-templates";

async function main() {
  const prisma = new PrismaClient();
  try {
    const summary = await seedB12NotificationTemplateStructure(prisma as any);
    console.log(JSON.stringify({ ok: true, ...summary }));
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
