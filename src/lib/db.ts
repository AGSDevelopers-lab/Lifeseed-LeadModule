import "server-only";

/**
 * Single PrismaClient on DATABASE_URL (Supabase pgBouncer :6543).
 * Interactive transactions survive pooler churn via LEAD_INTERACTIVE_TX_OPTIONS
 * (maxWait 10s / timeout 20s) on B04 persist paths — Option A hotfix.
 *
 * [FUTURE] Option B: export prismaDirect on DIRECT_URL (session :5432) and
 * route repository.$transaction exclusively through it; keep this client for reads.
 */

import { PrismaClient } from "@prisma/client";

import { createAuditedPrismaClient } from "@/lib/audit";

const globalForPrisma = globalThis as unknown as {
  prisma: ReturnType<typeof createAuditedPrismaClient> | undefined;
};

function createPrismaClient() {
  const base = new PrismaClient({
    log:
      process.env.NODE_ENV === "development"
        ? ["query", "error", "warn"]
        : ["error"],
  });

  return createAuditedPrismaClient(base);
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
