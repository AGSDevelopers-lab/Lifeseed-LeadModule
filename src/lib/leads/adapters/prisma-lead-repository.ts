import type { Lead as PrismaLead, Prisma } from "@prisma/client";

import { prisma } from "@/lib/db";
import type { LeadActivity } from "../domain/entities/LeadActivity";
import type { LeadAssignment } from "../domain/entities/LeadAssignment";
import type { LeadFollowUp } from "../domain/entities/LeadFollowUp";
import type { LeadOutboxEvent } from "../domain/entities/LeadOutboxEvent";
import type { LeadScore } from "../domain/entities/LeadScore";
import type { LeadStatusHistory } from "../domain/entities/LeadStatusHistory";
import { Lead } from "../domain/entities/Lead";
import { LeadOwnershipDeniedError } from "../domain/errors";
import { LeadStatus } from "../domain/enums";
import type { LeadRepository } from "../domain/ports/LeadRepository";
import type { ActorContext } from "../domain/ports/shared";
import { evaluateLeadAccess } from "./lead-access-scope";
import { activityToDomain } from "./mappers/activity-mapper";
import { assignmentToDomain } from "./mappers/assignment-mapper";
import { followUpToDomain } from "./mappers/follow-up-mapper";
import { leadToDomain } from "./mappers/lead-mapper";
import { outboxEventToDomain } from "./mappers/outbox-event-mapper";
import { scoreToDomain } from "./mappers/score-mapper";
import { statusHistoryToDomain } from "./mappers/status-history-mapper";
import {
  prismaLeadAudit,
  type LeadAccessAuditor,
} from "./prisma-audit";

type AccessInclude = {
  counsellingBooking: { select: { counsellorUserId: true } };
  assignedTelecaller: { select: { siteId: true } };
};

type LeadAccessRow = PrismaLead & {
  counsellingBooking: { counsellorUserId: string } | null;
  assignedTelecaller: { siteId: string | null } | null;
};

const ACCESS_INCLUDE = {
  counsellingBooking: { select: { counsellorUserId: true } },
  assignedTelecaller: { select: { siteId: true } },
} satisfies AccessInclude;

export type LeadReadDb = {
  lead: {
    findUnique: (args: {
      where: { id: string };
      include: typeof ACCESS_INCLUDE;
    }) => Promise<LeadAccessRow | null>;
  };
};

function toDomain(row: LeadAccessRow): Lead {
  return leadToDomain(row);
}

export class PrismaLeadRepository implements LeadRepository {
  constructor(
    private readonly db: LeadReadDb = prisma as unknown as LeadReadDb,
    private readonly accessAudit: LeadAccessAuditor = prismaLeadAudit,
  ) {}

  async byId(id: string, ctx?: ActorContext): Promise<Lead | null> {
    const row = await this.db.lead.findUnique({
      where: { id },
      include: ACCESS_INCLUDE,
    });
    if (!row) return null;
    if (!ctx) return toDomain(row);

    const decision = evaluateLeadAccess(
      {
        leadId: row.id,
        assignedTelecallerId: row.assignedTelecallerId,
        counsellorUserId: row.counsellingBooking?.counsellorUserId ?? null,
        siteId: row.assignedTelecaller?.siteId ?? null,
      },
      ctx,
    );
    if (!decision.allowed) {
      await this.accessAudit.recordDenied({
        actorUserId: ctx.userId,
        actorRoles: ctx.roles,
        leadId: row.id,
        denialReason: decision.denialReason,
        requiredPermission: decision.requiredPermission,
        siteId: ctx.siteId ?? null,
      });
      throw new LeadOwnershipDeniedError("Lead not in caller scope", {
        leadId: id,
        userId: ctx.userId,
        denialReason: decision.denialReason,
        requiredPermission: decision.requiredPermission,
      });
    }
    return toDomain(row);
  }

  async create(lead: Lead): Promise<Lead> {
    throw new Error(
      `PrismaLeadRepository.create is not implemented in B02 (${lead.id})`,
    );
  }

  async update(lead: Lead): Promise<Lead> {
    throw new Error(
      `PrismaLeadRepository.update is not implemented in B02 (${lead.id})`,
    );
  }
}

export const prismaLeadRepository = new PrismaLeadRepository();

const TELECALLER_DETAIL_INCLUDE = {
  callDispositions: { orderBy: { createdAt: "desc" as const }, take: 20 },
  counsellingBooking: true,
} satisfies Prisma.LeadInclude;

const ADMIN_DETAIL_INCLUDE = {
  assignedTelecaller: { select: { id: true, email: true } },
  callDispositions: {
    orderBy: { createdAt: "desc" as const },
    include: { telecaller: { select: { email: true } } },
  },
  counsellingBooking: { include: { counsellor: { select: { email: true } } } },
  convertedDonor: { select: { id: true, donorCode: true } },
} satisfies Prisma.LeadInclude;

export type TelecallerLeadDetail = Prisma.LeadGetPayload<{
  include: typeof TELECALLER_DETAIL_INCLUDE;
}>;

export type AdminLeadDetail = Prisma.LeadGetPayload<{
  include: typeof ADMIN_DETAIL_INCLUDE;
}>;

async function requireReadableThenLoad<T>(
  id: string,
  ctx: ActorContext,
  load: () => Promise<T | null>,
  audit: LeadAccessAuditor,
): Promise<T | null> {
  const domain = await prismaLeadRepository.byId(id, ctx);
  if (!domain) return null;
  await audit.recordView({
    actorUserId: ctx.userId,
    actorRoles: ctx.roles,
    leadId: id,
    siteId: ctx.siteId ?? domain.props.ownership.siteId,
  });
  return load();
}

export async function loadTelecallerLeadDetail(
  id: string,
  ctx: ActorContext,
  audit: LeadAccessAuditor = prismaLeadAudit,
): Promise<TelecallerLeadDetail | null> {
  return requireReadableThenLoad(id, ctx, () =>
    prisma.lead.findUnique({
      where: { id },
      include: TELECALLER_DETAIL_INCLUDE,
    }),
    audit,
  );
}

export async function loadAdminLeadDetail(
  id: string,
  ctx: ActorContext,
  audit: LeadAccessAuditor = prismaLeadAudit,
): Promise<AdminLeadDetail | null> {
  return requireReadableThenLoad(id, ctx, () =>
    prisma.lead.findUnique({
      where: { id },
      include: ADMIN_DETAIL_INCLUDE,
    }),
    audit,
  );
}

export async function assertLeadReadable(
  id: string,
  ctx: ActorContext,
): Promise<Lead> {
  const lead = await prismaLeadRepository.byId(id, ctx);
  if (!lead) {
    throw new LeadOwnershipDeniedError("Lead not found", {
      leadId: id,
      userId: ctx.userId,
      denialReason: "NOT_FOUND",
    });
  }
  return lead;
}

/** Interactive-tx options for pgBouncer transaction-mode (Supabase :6543). */
export const LEAD_INTERACTIVE_TX_OPTIONS = {
  maxWait: 10_000,
  timeout: 20_000,
} as const;

/** Sole authorised Lead.status writer besides persistBundle. */
export async function applyAuthorizedLeadStatus(
  leadId: string,
  nextStatus: LeadStatus,
  extra: Prisma.LeadUncheckedUpdateInput = {},
): Promise<void> {
  await prisma.lead.update({
    where: { id: leadId },
    data: { status: nextStatus, ...extra },
  });
}

export async function runLeadWriteTransaction<T>(
  fn: (tx: Prisma.TransactionClient) => Promise<T>,
): Promise<T> {
  return prisma.$transaction(
    (tx) => fn(tx as Prisma.TransactionClient),
    LEAD_INTERACTIVE_TX_OPTIONS,
  );
}

export async function appendActivity(
  tx: Prisma.TransactionClient,
  data: Prisma.LeadActivityCreateInput,
): Promise<LeadActivity> {
  const row = await tx.leadActivity.create({ data });
  return activityToDomain(row);
}

export async function appendStatusHistory(
  tx: Prisma.TransactionClient,
  data: Prisma.LeadStatusHistoryCreateInput,
): Promise<LeadStatusHistory> {
  const row = await tx.leadStatusHistory.create({ data });
  return statusHistoryToDomain(row);
}

export async function appendAssignment(
  tx: Prisma.TransactionClient,
  data: Prisma.LeadAssignmentCreateInput,
): Promise<LeadAssignment> {
  const row = await tx.leadAssignment.create({ data });
  return assignmentToDomain(row);
}

export async function appendScore(
  tx: Prisma.TransactionClient,
  data: Prisma.LeadScoreCreateInput,
): Promise<LeadScore> {
  const row = await tx.leadScore.create({ data });
  return scoreToDomain(row);
}

export async function appendFollowUp(
  tx: Prisma.TransactionClient,
  data: Prisma.LeadFollowUpCreateInput,
): Promise<LeadFollowUp> {
  const row = await tx.leadFollowUp.create({ data });
  return followUpToDomain(row);
}

export async function appendOutboxEvent(
  tx: Prisma.TransactionClient,
  data: Prisma.LeadOutboxEventCreateInput,
): Promise<LeadOutboxEvent> {
  const row = await tx.leadOutboxEvent.create({ data });
  return outboxEventToDomain(row);
}
