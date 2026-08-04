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
