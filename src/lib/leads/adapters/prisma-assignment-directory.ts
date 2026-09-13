import { UserRole, type LeadStatus, type PrismaClient } from "@prisma/client";

import { prisma } from "@/lib/db";
import { getConfigStoreAdapter } from "@/lib/leads/adapters/config-store-adapter";
import { countAssignedOpenLeads } from "@/lib/leads/adapters/prisma-lead-repository";
import { resolveConfigPayload } from "@/lib/leads/application/config-store";
import { ASSIGNMENT_ELIGIBLE_ROLES } from "@/lib/leads/application/assignment-policy";
import { DEFAULT_ASSIGNMENT_RULES } from "@/lib/leads/config/defaults";
import { CONFIG_KEYS } from "@/lib/leads/config/keys";
import type { AssignmentRules } from "@/lib/leads/config/schemas";
import type {
  AssignmentDirectory,
  TelecallerAvailability,
} from "@/lib/leads/domain/ports/AssignmentDirectory";

type DirectoryDb = {
  user: {
    findMany: PrismaClient["user"]["findMany"];
    findUnique: PrismaClient["user"]["findUnique"];
  };
};

/**
 * Fallback AssignmentDirectory. Uses only User.siteId, User.isActive, TELECALLER /
 * SR_TELECALLER roles, and countAssignedOpenLeads. languages/skills are always [] —
 * never inferred. Shift-based availability is DEFERRED pending IAM Module 12.
 */
export class PrismaAssignmentDirectory implements AssignmentDirectory {
  constructor(
    private readonly db: DirectoryDb,
    private readonly countOpen: (userId: string, openStatuses: LeadStatus[]) => Promise<number>,
    private readonly openStatuses: LeadStatus[],
  ) {}

  async listAvailableTelecallers(siteId?: string | null): Promise<TelecallerAvailability[]> {
    const users = await this.db.user.findMany({
      where: {
        isActive: true,
        roles: { some: { role: { in: [...ASSIGNMENT_ELIGIBLE_ROLES] as UserRole[] } } },
        ...(siteId ? { siteId } : {}),
      },
      select: { id: true, siteId: true },
    });
    const rows: TelecallerAvailability[] = [];
    for (const user of users) {
      const openLeadCount = await this.countOpen(user.id, this.openStatuses);
      rows.push({
        userId: user.id,
        siteId: user.siteId,
        openLeadCount,
        // IAM Module 12 deferred — do not fabricate telecaller languages/skills.
        languages: [],
        skills: [],
      });
    }
    return rows;
  }
}

export async function loadAssignmentRules(): Promise<AssignmentRules> {
  const envCap = Number(process.env.LEADS_MAX_QUEUE_PER_TELECALLER ?? "20");
  const fallback: AssignmentRules = {
    ...DEFAULT_ASSIGNMENT_RULES,
    maxQueuePerTelecaller:
      Number.isFinite(envCap) && envCap > 0
        ? envCap
        : DEFAULT_ASSIGNMENT_RULES.maxQueuePerTelecaller,
    autoAssignEnabled: process.env.LEADS_AUTO_ASSIGN_ENABLED !== "false",
  };
  return resolveConfigPayload(
    getConfigStoreAdapter(prisma),
    CONFIG_KEYS.ASSIGNMENT_RULES_V1,
    fallback,
  );
}

export async function createPrismaAssignmentDirectory(
  db: DirectoryDb = prisma,
): Promise<PrismaAssignmentDirectory> {
  const rules = await loadAssignmentRules();
  return new PrismaAssignmentDirectory(
    db,
    countAssignedOpenLeads,
    rules.openStatuses as LeadStatus[],
  );
}

export async function lookupUserSiteAndActive(
  userId: string,
  db: DirectoryDb = prisma,
): Promise<{ siteId: string | null; isActive: boolean } | null> {
  const row = await db.user.findUnique({
    where: { id: userId },
    select: { siteId: true, isActive: true },
  });
  if (!row) return null;
  return { siteId: row.siteId, isActive: row.isActive };
}
