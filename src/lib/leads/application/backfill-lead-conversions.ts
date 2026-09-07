import { ConversionTarget } from "@prisma/client";

export type BackfillLeadRow = {
  id: string;
  convertedDonorId: string | null;
  convertedRecipientId: string | null;
  convertedAt: Date | null;
  assignedTelecallerId: string | null;
};

export type BackfillDb = {
  lead: {
    findMany: (args: object) => Promise<BackfillLeadRow[]>;
  };
  leadConversion: {
    findUnique: (args: { where: { leadId: string } }) => Promise<{ id: string } | null>;
    create: (args: object) => Promise<unknown>;
  };
  user: {
    findFirst: (args: object) => Promise<{ id: string } | null>;
  };
};

export async function resolveSystemUserId(
  db: BackfillDb,
  env: { LEAD_SYSTEM_USER_ID?: string } | NodeJS.ProcessEnv = process.env,
): Promise<string> {
  if (env.LEAD_SYSTEM_USER_ID) return env.LEAD_SYSTEM_USER_ID;
  const user = await db.user.findFirst({
    where: { roles: { some: { role: "BANK_SUPER_ADMIN" } } },
    select: { id: true },
  });
  if (!user) {
    throw new Error("SYSTEM user unresolved: set LEAD_SYSTEM_USER_ID");
  }
  return user.id;
}

export async function backfillLeadConversions(
  db: BackfillDb,
  env: { LEAD_SYSTEM_USER_ID?: string } | NodeJS.ProcessEnv = process.env,
): Promise<{ scanned: number; inserted: number }> {
  const systemUserId = await resolveSystemUserId(db, env);
  const leads = await db.lead.findMany({
    where: {
      OR: [{ convertedDonorId: { not: null } }, { convertedRecipientId: { not: null } }],
    },
    select: {
      id: true,
      convertedDonorId: true,
      convertedRecipientId: true,
      convertedAt: true,
      assignedTelecallerId: true,
    },
  });

  let inserted = 0;
  for (const lead of leads) {
    const existing = await db.leadConversion.findUnique({ where: { leadId: lead.id } });
    if (existing) continue;
    const targetType = lead.convertedDonorId ? ConversionTarget.DONOR : ConversionTarget.RECIPIENT;
    const targetEntityId = lead.convertedDonorId ?? lead.convertedRecipientId;
    if (!targetEntityId) continue;
    await db.leadConversion.create({
      data: {
        leadId: lead.id,
        targetType,
        targetEntityId,
        decidedByUserId: lead.assignedTelecallerId ?? systemUserId,
        eligibilitySnapshot: { backfill: true },
        occurredAt: lead.convertedAt ?? new Date(),
        notes: "v2.1_backfill",
      },
    });
    inserted += 1;
  }
  return { scanned: leads.length, inserted };
}
