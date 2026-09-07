import { prisma } from "../src/lib/db";
import { backfillLeadConversions } from "../src/lib/leads/application/backfill-lead-conversions";

async function main() {
  const summary = await backfillLeadConversions(prisma as never);
  console.log(JSON.stringify({ ok: true, ...summary }));
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
