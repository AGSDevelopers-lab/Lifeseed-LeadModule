import { Prisma } from "@prisma/client";

import { CONFIG_DEFAULTS } from "../config/defaults";
import {
  CONFIG_KEY_LIST,
  CONFIG_OWNER_ROLE,
  payloadSchemaRefFor,
  type ConfigKey,
} from "../config/keys";

export type SeedConfigDb = {
  user: {
    findFirst: (args?: object) => Promise<{ id: string } | null>;
    findMany: (args?: object) => Promise<Array<{ id: string }>>;
  };
  leadConfig: {
    findUnique: (args: object) => Promise<{ id: string } | null>;
    create: (args: { data: object }) => Promise<unknown>;
  };
};

export async function resolveSeedActors(
  db: SeedConfigDb,
  env: NodeJS.ProcessEnv | { LEAD_SYSTEM_USER_ID?: string; LEAD_CONFIG_APPROVER_USER_ID?: string } = process.env,
): Promise<{ createdByUserId: string; approvedByUserId: string }> {
  const createdByUserId =
    env.LEAD_SYSTEM_USER_ID ??
    (
      await db.user.findFirst({
        where: { roles: { some: { role: "BANK_SUPER_ADMIN" } } },
        select: { id: true },
      })
    )?.id;
  if (!createdByUserId) {
    throw new Error("SYSTEM user unresolved: set LEAD_SYSTEM_USER_ID");
  }
  const approvedByUserId =
    env.LEAD_CONFIG_APPROVER_USER_ID && env.LEAD_CONFIG_APPROVER_USER_ID !== createdByUserId
      ? env.LEAD_CONFIG_APPROVER_USER_ID
      : (
          await db.user.findFirst({
            where: {
              id: { not: createdByUserId },
              roles: { some: { role: { in: ["BANK_SUPER_ADMIN", "OPS_MANAGER"] } } },
            },
            select: { id: true },
          })
        )?.id;
  if (!approvedByUserId) {
    throw new Error(
      "SoD requires a distinct approver: set LEAD_CONFIG_APPROVER_USER_ID to a user other than the system author",
    );
  }
  return { createdByUserId, approvedByUserId };
}

export async function seedLeadConfigDefaults(
  db: object,
  env: NodeJS.ProcessEnv | { LEAD_SYSTEM_USER_ID?: string; LEAD_CONFIG_APPROVER_USER_ID?: string } = process.env,
): Promise<{ inserted: number; skipped: number }> {
  const client = db as SeedConfigDb;
  const actors = await resolveSeedActors(client, env);
  const now = new Date();
  let inserted = 0;
  let skipped = 0;
  for (const key of CONFIG_KEY_LIST) {
    const existing = await client.leadConfig.findUnique({
      where: { key_version: { key, version: 1 } },
    });
    if (existing) {
      skipped += 1;
      continue;
    }
    await client.leadConfig.create({
      data: {
        key,
        version: 1,
        payload: CONFIG_DEFAULTS[key as ConfigKey] as Prisma.InputJsonValue,
        payloadSchemaRef: payloadSchemaRefFor(key),
        ownerRole: CONFIG_OWNER_ROLE[key],
        createdByUserId: actors.createdByUserId,
        approvedByUserId: actors.approvedByUserId,
        approvedAt: now,
        effectiveFrom: now,
        isActive: true,
        notes: "v2.1 frozen defaults (B09 seed)",
      },
    });
    inserted += 1;
  }
  return { inserted, skipped };
}
