import { CampaignStatus, LeadSource, Prisma, type PrismaClient } from "@prisma/client";

import { prisma as defaultPrisma } from "@/lib/db";
import { actorHasPerm } from "@/lib/leads/application/guard-facts";
import {
  CampaignIllegalTransitionError,
  LeadGuardFailedError,
  LeadPermissionDeniedError,
} from "@/lib/leads/domain/errors";
import { CampaignStatus as DomainCampaignStatus, LeadSource as DomainLeadSource } from "@/lib/leads/domain/enums";
import type { ActorContext } from "@/lib/leads/domain/ports/shared";
import { isLegalPatchStatus, requiredNextStatus } from "@/lib/leads/domain/attribution/rules";

type Db = typeof defaultPrisma;

const SOURCES = new Set<string>(Object.values(DomainLeadSource));

export type CampaignCreateInput = {
  name: string;
  code: string;
  source: string;
  medium?: string | null;
  channel?: string | null;
  startAt: Date;
  endAt?: Date | null;
  budgetInr?: string | number | null;
  actualSpendInr?: string | number | null;
  ownerUserId: string;
  creativeRefs?: Prisma.InputJsonValue | null;
  landingPageUrls?: Prisma.InputJsonValue | null;
  referralPartnerId?: string | null;
  utmDefaults?: Prisma.InputJsonValue | null;
  notes?: string | null;
};

export type CampaignPatchInput = {
  name?: string;
  medium?: string | null;
  channel?: string | null;
  startAt?: Date;
  endAt?: Date | null;
  budgetInr?: string | number | null;
  actualSpendInr?: string | number | null;
  creativeRefs?: Prisma.InputJsonValue | null;
  landingPageUrls?: Prisma.InputJsonValue | null;
  referralPartnerId?: string | null;
  utmDefaults?: Prisma.InputJsonValue | null;
  notes?: string | null;
  status?: string;
};

async function requireCampaignPerm(actor: ActorContext, perm: string): Promise<void> {
  const ok = await actorHasPerm(actor, perm);
  if (!ok) {
    throw new LeadPermissionDeniedError(`Missing permission ${perm}`, { permission: perm });
  }
}

function money(v: string | number | null | undefined): Prisma.Decimal | null | undefined {
  if (v === undefined) return undefined;
  if (v === null || v === "") return null;
  return new Prisma.Decimal(v);
}

export async function listCampaigns(actor: ActorContext, db: Db = defaultPrisma) {
  await requireCampaignPerm(actor, "campaign.view");
  return db.campaign.findMany({ orderBy: { createdAt: "desc" } });
}

export async function getCampaign(actor: ActorContext, id: string, db: Db = defaultPrisma) {
  await requireCampaignPerm(actor, "campaign.view");
  const row = await db.campaign.findUnique({ where: { id } });
  if (!row) throw new LeadGuardFailedError("Campaign not found", { id });
  return row;
}

export async function createCampaign(actor: ActorContext, input: CampaignCreateInput, db: Db = defaultPrisma) {
  await requireCampaignPerm(actor, "campaign.create");
  if (!SOURCES.has(input.source)) {
    throw new LeadGuardFailedError("Invalid campaign source", { source: input.source });
  }
  try {
    return await db.campaign.create({
      data: {
        name: input.name,
        code: input.code,
        source: input.source as LeadSource,
        medium: input.medium ?? null,
        channel: input.channel ?? null,
        startAt: input.startAt,
        endAt: input.endAt ?? null,
        budgetInr: money(input.budgetInr),
        actualSpendInr: money(input.actualSpendInr),
        ownerUserId: input.ownerUserId,
        creativeRefs: input.creativeRefs ?? undefined,
        landingPageUrls: input.landingPageUrls ?? undefined,
        referralPartnerId: input.referralPartnerId ?? null,
        utmDefaults: input.utmDefaults ?? undefined,
        status: CampaignStatus.DRAFT,
        notes: input.notes ?? null,
      },
    });
  } catch (err) {
    if (typeof err === "object" && err && "code" in err && (err as { code: string }).code === "P2002") {
      throw new LeadGuardFailedError("Campaign code already exists", { code: input.code });
    }
    throw err;
  }
}

export async function patchCampaign(
  actor: ActorContext,
  id: string,
  input: CampaignPatchInput,
  db: Db = defaultPrisma,
) {
  await requireCampaignPerm(actor, "campaign.edit");
  const row = await db.campaign.findUnique({ where: { id } });
  if (!row) throw new LeadGuardFailedError("Campaign not found", { id });

  if (input.status !== undefined) {
    const requested = input.status;
    if (!isLegalPatchStatus(row.status, requested as (typeof DomainCampaignStatus)[keyof typeof DomainCampaignStatus])) {
      throw new CampaignIllegalTransitionError("Illegal campaign status patch", {
        from: row.status,
        requested,
      });
    }
  }

  return db.campaign.update({
    where: { id },
    data: {
      name: input.name,
      medium: input.medium,
      channel: input.channel,
      startAt: input.startAt,
      endAt: input.endAt,
      budgetInr: money(input.budgetInr),
      actualSpendInr: money(input.actualSpendInr),
      creativeRefs: input.creativeRefs === undefined ? undefined : (input.creativeRefs === null ? Prisma.DbNull : input.creativeRefs),
      landingPageUrls: input.landingPageUrls === undefined ? undefined : (input.landingPageUrls === null ? Prisma.DbNull : input.landingPageUrls),
      referralPartnerId: input.referralPartnerId,
      utmDefaults: input.utmDefaults === undefined ? undefined : (input.utmDefaults === null ? Prisma.DbNull : input.utmDefaults),
      notes: input.notes,
      status: input.status === DomainCampaignStatus.PAUSED ? CampaignStatus.PAUSED : undefined,
    },
  });
}

export async function activateCampaign(actor: ActorContext, id: string, db: Db = defaultPrisma) {
  await requireCampaignPerm(actor, "campaign.activate");
  const row = await db.campaign.findUnique({ where: { id } });
  if (!row) throw new LeadGuardFailedError("Campaign not found", { id });
  const next = requiredNextStatus("activate", row.status);
  if (!next) {
    throw new CampaignIllegalTransitionError("Illegal activate transition", { from: row.status });
  }
  return db.campaign.update({
    where: { id },
    data: { status: CampaignStatus.ACTIVE },
  });
}

export async function endCampaign(actor: ActorContext, id: string, db: Db = defaultPrisma) {
  await requireCampaignPerm(actor, "campaign.end");
  const row = await db.campaign.findUnique({ where: { id } });
  if (!row) throw new LeadGuardFailedError("Campaign not found", { id });
  const next = requiredNextStatus("end", row.status);
  if (!next) {
    throw new CampaignIllegalTransitionError("Illegal end transition", { from: row.status });
  }
  return db.campaign.update({
    where: { id },
    data: { status: CampaignStatus.ENDED, endAt: row.endAt ?? new Date() },
  });
}
