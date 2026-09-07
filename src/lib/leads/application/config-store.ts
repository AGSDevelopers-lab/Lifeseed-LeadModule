import { Prisma } from "@prisma/client";

import type { ConfigStoreAdapter } from "@/lib/leads/adapters/config-store-adapter";
import { configToDomain, type PrismaConfigRow } from "@/lib/leads/adapters/mappers/config-mapper";
import { CONFIG_DEFAULTS } from "@/lib/leads/config/defaults";
import { getLeadConfigMode, type LeadConfigMode } from "@/lib/leads/config/flag";
import {
  CONFIG_OWNER_ROLE,
  isConfigKey,
  payloadSchemaRefFor,
  type ConfigKey,
} from "@/lib/leads/config/keys";
import { parseConfigPayload } from "@/lib/leads/config/schemas";
import type { LeadConfig } from "@/lib/leads/domain/entities/LeadConfig";
import { LeadInvariantViolationError } from "@/lib/leads/domain/errors";

export class ConfigSodViolationError extends Error {
  readonly code = "CONFIG_SOD_VIOLATION";
  constructor() {
    super("Author cannot approve their own config version");
    this.name = "ConfigSodViolationError";
  }
}

export type AuditFn = (entry: {
  actorUserId: string;
  action: string;
  entityType: string;
  entityId: string;
  afterJson: Prisma.InputJsonValue;
}) => Promise<unknown>;

export type ConfigWriteDb = {
  leadConfig: {
    findFirst: (args?: object) => Promise<PrismaConfigRow | null>;
    findUnique: (args: object) => Promise<PrismaConfigRow | null>;
    findMany: (args: object) => Promise<PrismaConfigRow[]>;
    create: (args: { data: object }) => Promise<PrismaConfigRow>;
    update: (args: { where: { id: string }; data: object }) => Promise<PrismaConfigRow>;
  };
  $transaction: <T>(fn: (tx: ConfigWriteDb) => Promise<T>) => Promise<T>;
};

export async function resolveConfigPayload<T extends Record<string, unknown>>(
  adapter: ConfigStoreAdapter,
  key: ConfigKey,
  fallback: T,
  options?: { version?: number; at?: Date; mode?: LeadConfigMode },
): Promise<T> {
  const mode = options?.mode ?? getLeadConfigMode();
  if (mode === "off") return fallback;
  try {
    const payload =
      options?.at != null
        ? await adapter.getActive<T>(key, options.at)
        : await adapter.read<T>(key, options?.version);
    if (payload) return payload;
    if (mode === "on") {
      throw new LeadInvariantViolationError("Required LeadConfig key is missing", { key });
    }
    return fallback;
  } catch (err) {
    if (mode === "on") throw err;
    if (mode === "partial") return fallback;
    throw err;
  }
}

export async function getCurrentConfig(db: object, key: ConfigKey): Promise<LeadConfig | null> {
  const client = db as ConfigWriteDb;
  const row = await client.leadConfig.findFirst({
    where: { key, isActive: true },
    orderBy: { version: "desc" },
  });
  return row ? configToDomain(row) : null;
}

export async function proposeConfigVersion(
  db: object,
  input: {
    key: ConfigKey;
    payload: unknown;
    notes?: string | null;
    effectiveFrom?: Date | null;
    actorUserId: string;
  },
  auditLog: AuditFn,
): Promise<LeadConfig> {
  const client = db as ConfigWriteDb;
  const parsed = parseConfigPayload(input.key, input.payload);
  if (!parsed.success) {
    throw new LeadInvariantViolationError("Config payload failed schema validation", {
      key: input.key,
      issues: parsed.error.issues,
    });
  }
  const latest = await client.leadConfig.findFirst({
    where: { key: input.key },
    orderBy: { version: "desc" },
  });
  const version = (latest?.version ?? 0) + 1;
  const row = await client.leadConfig.create({
    data: {
      key: input.key,
      version,
      payload: parsed.data as Prisma.InputJsonValue,
      payloadSchemaRef: payloadSchemaRefFor(input.key),
      ownerRole: CONFIG_OWNER_ROLE[input.key],
      createdByUserId: input.actorUserId,
      approvedByUserId: null,
      approvedAt: null,
      effectiveFrom: input.effectiveFrom ?? null,
      effectiveUntil: null,
      isActive: false,
      notes: input.notes ?? null,
    },
  });
  await auditLog({
    actorUserId: input.actorUserId,
    action: "lead.config.propose",
    entityType: "LeadConfig",
    entityId: row.id,
    afterJson: { key: input.key, version } as Prisma.InputJsonValue,
  });
  return configToDomain(row);
}

export async function approveConfigVersion(
  db: object,
  input: { key: ConfigKey; version: number; actorUserId: string },
  auditLog: AuditFn,
  adapter?: ConfigStoreAdapter,
): Promise<LeadConfig> {
  const client = db as ConfigWriteDb;
  const row = await client.leadConfig.findUnique({
    where: { key_version: { key: input.key, version: input.version } },
  });
  if (!row) {
    throw new LeadInvariantViolationError("Config version not found", {
      key: input.key,
      version: input.version,
    });
  }
  if (row.createdByUserId === input.actorUserId) {
    throw new ConfigSodViolationError();
  }
  const now = new Date();
  const effectiveFrom = row.effectiveFrom ?? now;
  const activateNow = effectiveFrom.getTime() <= now.getTime();

  const updated = await client.$transaction(async (tx) => {
    if (activateNow) {
      const prior = await tx.leadConfig.findMany({
        where: { key: input.key, isActive: true, NOT: { id: row.id } },
      });
      for (const p of prior) {
        await tx.leadConfig.update({
          where: { id: p.id },
          data: { isActive: false, effectiveUntil: effectiveFrom },
        });
      }
    }
    return tx.leadConfig.update({
      where: { id: row.id },
      data: {
        approvedByUserId: input.actorUserId,
        approvedAt: now,
        effectiveFrom,
        isActive: activateNow,
      },
    });
  });

  adapter?.invalidate(input.key);

  await auditLog({
    actorUserId: input.actorUserId,
    action: "lead.config.approve",
    entityType: "LeadConfig",
    entityId: updated.id,
    afterJson: {
      key: input.key,
      version: input.version,
      isActive: updated.isActive,
      effectiveFrom: updated.effectiveFrom?.toISOString() ?? null,
    } as Prisma.InputJsonValue,
  });
  if (updated.isActive) {
    await auditLog({
      actorUserId: input.actorUserId,
      action: "lead.config.activate",
      entityType: "LeadConfig",
      entityId: updated.id,
      afterJson: { key: input.key, version: input.version } as Prisma.InputJsonValue,
    });
  }
  return configToDomain(updated);
}

export function assertConfigKey(key: string): ConfigKey {
  if (!isConfigKey(key)) {
    throw new LeadInvariantViolationError("Unknown config key", { key });
  }
  return key;
}

export { CONFIG_DEFAULTS };
