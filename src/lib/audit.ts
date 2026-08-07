import { createHash } from "crypto";

import type { Prisma, PrismaClient } from "@prisma/client";

export type AuditAction =
  | "CREATE"
  | "UPDATE"
  | "DELETE"
  | "STATE_TRANSITION"
  | "APPROVE"
  | "READ_SENSITIVE"
  | "WITNESS_ATTEST"
  | "role.assigned";

export type AuditRecordInput = {
  actorUserId?: string | null;
  action: AuditAction | string;
  entityType: string;
  entityId: string;
  beforeJson?: Prisma.InputJsonValue | null;
  afterJson?: Prisma.InputJsonValue | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  donorRelId?: string | null;
  sampleRelId?: string | null;
};

const WRITE_OPS = new Set([
  "create",
  "createMany",
  "update",
  "updateMany",
  "upsert",
  "delete",
  "deleteMany",
]);

/** Models that must not recurse into audit logging. */
const SKIP_AUDIT_MODELS = new Set(["AuditLog", "EventEmission"]);

function hashPayload(previousHash: string, payload: unknown): string {
  return createHash("sha256")
    .update(previousHash)
    .update(JSON.stringify(payload))
    .digest("hex");
}

/**
 * Manual audit write — use for READ_SENSITIVE, WITNESS_ATTEST, custom events.
 * Auto-write path lives in createAuditedPrismaClient().
 */
export async function recordAudit(
  client: PrismaClient,
  input: AuditRecordInput,
): Promise<void> {
  const last = await client.auditLog.findFirst({
    orderBy: { timestamp: "desc" },
    select: { hashChain: true },
  });

  const previousHash = last?.hashChain ?? "GENESIS";
  const hashChain = hashPayload(previousHash, {
    action: input.action,
    entityType: input.entityType,
    entityId: input.entityId,
    beforeJson: input.beforeJson ?? null,
    afterJson: input.afterJson ?? null,
    actorUserId: input.actorUserId ?? null,
    timestamp: new Date().toISOString(),
  });

  await client.auditLog.create({
    data: {
      actorUserId: input.actorUserId ?? null,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId,
      beforeJson: input.beforeJson ?? undefined,
      afterJson: input.afterJson ?? undefined,
      ipAddress: input.ipAddress ?? null,
      userAgent: input.userAgent ?? null,
      donorRelId: input.donorRelId ?? null,
      sampleRelId: input.sampleRelId ?? null,
      hashChain,
    },
  });
}

/**
 * Convenience API: audit.log({ action: "role.assigned", ... })
 * Uses the audited Prisma singleton from db.ts.
 */
export const audit = {
  async log(input: AuditRecordInput): Promise<void> {
    const { prisma } = await import("@/lib/db");
    await recordAudit(prisma as unknown as PrismaClient, input);
  },
};

type QueryArgs = {
  model: string;
  operation: string;
  args: Record<string, unknown>;
  query: (args: Record<string, unknown>) => Promise<unknown>;
};

/**
 * Prisma Client Extension that logs CREATE / UPDATE / DELETE writes
 * into AuditLog with a per-chain SHA-256 hash.
 */
export function createAuditedPrismaClient(base: PrismaClient) {
  return base.$extends({
    name: "auditLog",
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }: QueryArgs) {
          if (!WRITE_OPS.has(operation) || SKIP_AUDIT_MODELS.has(model)) {
            return query(args);
          }

          const result = await query(args);

          try {
            const entityId = extractEntityId(result, args);
            const action = mapOperationToAction(operation);

            await recordAudit(base, {
              action,
              entityType: model,
              entityId,
              afterJson: toJsonSafe(result),
            });
          } catch (err) {
            console.error("[audit] failed to record write", {
              model,
              operation,
              err,
            });
          }

          return result;
        },
      },
    },
  });
}

function mapOperationToAction(operation: string): AuditAction {
  switch (operation) {
    case "create":
    case "createMany":
      return "CREATE";
    case "update":
    case "updateMany":
    case "upsert":
      return "UPDATE";
    case "delete":
    case "deleteMany":
      return "DELETE";
    default:
      return "UPDATE";
  }
}

function extractEntityId(
  result: unknown,
  args: Record<string, unknown>,
): string {
  if (result && typeof result === "object" && "id" in result) {
    const id = (result as { id: unknown }).id;
    if (typeof id === "string") return id;
  }

  const where = args.where as { id?: string } | undefined;
  if (where?.id) return where.id;

  return "unknown";
}

function toJsonSafe(value: unknown): Prisma.InputJsonValue | null {
  if (value === null || value === undefined) return null;
  try {
    return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
  } catch {
    return null;
  }
}
