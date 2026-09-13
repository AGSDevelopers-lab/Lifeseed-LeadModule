import { LeadSource, type PrismaClient } from "@prisma/client";

export async function backfillLeadAttribution(
  db: PrismaClient,
): Promise<{ scanned: number; inserted: number }> {
  const leads = await db.lead.findMany({
    where: { attribution: { is: null } },
    select: { id: true, source: true },
  });
  let inserted = 0;
  const now = new Date();
  for (const lead of leads) {
    const existing = await db.leadAttribution.findUnique({ where: { leadId: lead.id } });
    if (existing) continue;
    const source = lead.source as LeadSource;
    try {
      await db.$transaction(async (tx) => {
        await tx.leadAttribution.create({
          data: {
            leadId: lead.id,
            firstTouchAt: now,
            firstTouchSource: source,
            lastTouchAt: now,
            lastTouchSource: source,
          },
        });
        await tx.leadAttributionHistory.create({
          data: {
            leadId: lead.id,
            touchAt: now,
            source,
            touchType: "FIRST",
            capturedAt: now,
          },
        });
      });
      inserted += 1;
    } catch (err) {
      if (typeof err === "object" && err && "code" in err && (err as { code: string }).code === "P2002") {
        continue;
      }
      throw err;
    }
  }
  return { scanned: leads.length, inserted };
}
