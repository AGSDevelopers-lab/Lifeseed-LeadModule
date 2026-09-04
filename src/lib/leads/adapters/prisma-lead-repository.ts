import type { Lead as PrismaLead, Prisma } from "@prisma/client";

import { prisma } from "@/lib/db";
import { Lead } from "../domain/entities/Lead";
import { LeadOwnershipDeniedError } from "../domain/errors";
import {
  LeadOutcome,
  LeadPersonType,
  LeadSource,
  LeadStatus,
  LeadTier,
  type LeadDonorSubType,
} from "../domain/enums";
import type { LeadRepository } from "../domain/ports/LeadRepository";
import type { ActorContext } from "../domain/ports/shared";
import { ArchiveMeta } from "../domain/value-objects/ArchiveMeta";
import { Consent } from "../domain/value-objects/Consent";
import { ContactInfo } from "../domain/value-objects/ContactInfo";
import { LeadCode } from "../domain/value-objects/LeadCode";
import { TierScore } from "../domain/value-objects/TierScore";
import { evaluateLeadAccess } from "./lead-access-scope";
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
  const archive =
    row.isArchived && row.archivedAt
      ? new ArchiveMeta(row.archivedAt, row.archivedByUserId, row.archiveReason)
      : null;
  const scoreValue = row.latestScoreValue ?? row.score;
  const latestScore = new TierScore(
    Math.min(100, Math.max(0, Math.round(scoreValue))),
    row.tier as (typeof LeadTier)[keyof typeof LeadTier],
    row.latestScoreId ?? "legacy",
    row.capturedAt,
  );
  return new Lead({
    id: row.id,
    code: LeadCode.parse(row.leadCode),
    personType: row.personType as (typeof LeadPersonType)[keyof typeof LeadPersonType],
    donorSubtype: (row.donorSubType as LeadDonorSubType | null) ?? null,
    contact: new ContactInfo(
      row.fullName,
      row.phone,
      row.email,
      row.city,
      row.state,
      row.pincode,
      row.preferredLanguage,
    ),
    consent: new Consent(
      row.consentMarketing,
      row.consentScreening,
      row.consentDataProcessing,
      row.consentVersion,
      row.consentIp,
      row.consentUserAgent,
    ),
    status: row.status as (typeof LeadStatus)[keyof typeof LeadStatus],
    outcome: (row.outcome as (typeof LeadOutcome)[keyof typeof LeadOutcome] | null) ?? null,
    isArchived: row.isArchived,
    archive,
    source: row.source as (typeof LeadSource)[keyof typeof LeadSource],
    latestScore,
    latestScoreId: row.latestScoreId,
    ownership: {
      siteId: row.assignedTelecaller?.siteId ?? null,
      assignedTelecallerId: row.assignedTelecallerId,
      activeAssignmentId: row.activeAssignmentId,
    },
    retention: {
      capturedAt: row.capturedAt,
      retentionExpiresAt: row.retentionExpiresAt,
    },
    merge: { mergedIntoLeadId: row.mergedIntoLeadId },
    conversion: {
      convertedDonorId: row.convertedDonorId,
      convertedRecipientId: row.convertedRecipientId,
      convertedAt: row.convertedAt,
    },
    duplicate: { duplicateOfLeadId: row.duplicateOfLeadId },
    version: row.version,
  });
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
