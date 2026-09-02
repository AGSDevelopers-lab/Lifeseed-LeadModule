/**
 * Idempotent backfill: set currentTier = UNSCORED where currentSeedScoreId is null.
 *
 * Usage:
 *   npx tsx src/scripts/backfill-seedscore-unscored.ts
 *
 * Safe to re-run. Does not touch scored donors.
 */
import { PrismaClient, SeedScoreTier } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const result = await prisma.donor.updateMany({
    where: {
      currentSeedScoreId: null,
      OR: [{ currentTier: null }, { currentTier: { not: SeedScoreTier.UNSCORED } }],
    },
    data: { currentTier: SeedScoreTier.UNSCORED },
  });
  console.log(`Backfilled ${result.count} donor(s) to UNSCORED`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
