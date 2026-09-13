import { LeadSource, Prisma, type PrismaClient } from "@prisma/client";

import { prisma as defaultPrisma } from "@/lib/db";
import { actorHasPerm } from "@/lib/leads/application/guard-facts";
import {
  canonicalSource,
  historyTouchType,
  preserveUtm,
  resolveCampaignIdRule,
  type CaptureTouchFields,
  type UtmBlob,
} from "@/lib/leads/domain/attribution/rules";
import { LeadPermissionDeniedError } from "@/lib/leads/domain/errors";
import { LeadSource as DomainLeadSource } from "@/lib/leads/domain/enums";
import type { LeadSource as LeadSourceT } from "@/lib/leads/domain/enums";
import type { ActorContext } from "@/lib/leads/domain/ports/shared";

type Db = PrismaClient;

export type CaptureTouchInput = {
  leadId: string;
  source: LeadSourceT;
  campaignId?: string | null;
  medium?: string | null;
  channel?: string | null;
  creativeRef?: string | null;
  landingUrl?: string | null;
  referralPartnerId?: string | null;
  utm?: Record<string, unknown> | null;
  capturedAt?: Date;
  db?: Db;
};

function isP2002(err: unknown): boolean {
  return typeof err === "object" && err !== null && "code" in err && (err as { code: string }).code === "P2002";
}

function asLeadSource(value: string): LeadSource {
  return value as LeadSource;
}

function utmCampaignRaw(utm: Record<string, unknown> | null | undefined): string | null {
  if (!utm) return null;
  const v = utm.campaign ?? utm.utm_campaign;
  return typeof v === "string" && v.length > 0 ? v : null;
}

export async function resolveCampaign(
  input: { campaignId?: string | null; utmCampaign?: string | null },
  db: Db = defaultPrisma,
): Promise<string | null> {
  if (input.campaignId) {
    const row = await db.campaign.findUnique({ where: { id: input.campaignId }, select: { id: true } });
    return row?.id ?? null;
  }
  const code = input.utmCampaign?.trim();
  if (!code) return null;
  const byCode = await db.campaign.findUnique({ where: { code }, select: { id: true } });
  return byCode?.id ?? null;
}

function fieldsFromInput(input: CaptureTouchInput, campaignId: string | null): CaptureTouchFields {
  const rawUtm = (input.utm ?? {}) as Record<string, unknown>;
  const rawSource = typeof rawUtm.source === "string" ? rawUtm.source : typeof rawUtm.utm_source === "string" ? rawUtm.utm_source : null;
  const source = canonicalSource(input.source, rawSource);
  const blob = preserveUtm(rawUtm, {
    campaign: utmCampaignRaw(rawUtm) ?? undefined,
    source: rawSource ?? undefined,
    medium: typeof rawUtm.medium === "string" ? rawUtm.medium : typeof rawUtm.utm_medium === "string" ? rawUtm.utm_medium : input.medium ?? undefined,
    term: typeof rawUtm.term === "string" ? rawUtm.term : typeof rawUtm.utm_term === "string" ? rawUtm.utm_term : undefined,
    content: typeof rawUtm.content === "string" ? rawUtm.content : typeof rawUtm.utm_content === "string" ? rawUtm.utm_content : undefined,
  });
  return {
    source,
    campaignId,
    medium: input.medium ?? (typeof blob.medium === "string" ? blob.medium : null),
    channel: input.channel ?? null,
    creativeRef: input.creativeRef ?? null,
    landingUrl: input.landingUrl ?? null,
    referralPartnerId: input.referralPartnerId ?? null,
    utm: blob,
  };
}

function attributionWrite(fields: CaptureTouchFields, at: Date) {
  const utm = fields.utm as Prisma.InputJsonValue;
  return {
    firstTouchAt: at,
    firstTouchSource: asLeadSource(fields.source),
    firstTouchCampaignId: fields.campaignId,
    firstTouchMedium: fields.medium,
    firstTouchChannel: fields.channel,
    firstTouchCreativeRef: fields.creativeRef,
    firstTouchLandingUrl: fields.landingUrl,
    firstTouchReferralPartnerId: fields.referralPartnerId,
    firstTouchUtm: utm,
    lastTouchAt: at,
    lastTouchSource: asLeadSource(fields.source),
    lastTouchCampaignId: fields.campaignId,
    lastTouchMedium: fields.medium,
    lastTouchChannel: fields.channel,
    lastTouchCreativeRef: fields.creativeRef,
    lastTouchLandingUrl: fields.landingUrl,
    lastTouchReferralPartnerId: fields.referralPartnerId,
    lastTouchUtm: utm,
  };
}

function historyWrite(leadId: string, fields: CaptureTouchFields, at: Date, isFirst: boolean) {
  return {
    leadId,
    touchAt: at,
    source: asLeadSource(fields.source),
    campaignId: fields.campaignId,
    medium: fields.medium,
    channel: fields.channel,
    creativeRef: fields.creativeRef,
    landingUrl: fields.landingUrl,
    referralPartnerId: fields.referralPartnerId,
    utm: fields.utm as Prisma.InputJsonValue,
    touchType: historyTouchType(isFirst),
    capturedAt: at,
  };
}

async function lockAttributionRow(tx: Prisma.TransactionClient, leadId: string): Promise<void> {
  await tx.$queryRaw`SELECT 1 FROM "LeadAttribution" WHERE "leadId" = ${leadId} FOR UPDATE`;
}

async function applyLastTouchFromLatestHistory(tx: Prisma.TransactionClient, leadId: string): Promise<void> {
  const latest = await tx.leadAttributionHistory.findFirst({
    where: { leadId },
    orderBy: [{ capturedAt: "desc" }, { id: "desc" }],
  });
  if (!latest) return;
  await tx.leadAttribution.update({
    where: { leadId },
    data: {
      lastTouchAt: latest.touchAt,
      lastTouchSource: latest.source,
      lastTouchCampaignId: latest.campaignId,
      lastTouchMedium: latest.medium,
      lastTouchChannel: latest.channel,
      lastTouchCreativeRef: latest.creativeRef,
      lastTouchLandingUrl: latest.landingUrl,
      lastTouchReferralPartnerId: latest.referralPartnerId,
      lastTouchUtm: latest.utm === null ? Prisma.JsonNull : (latest.utm as Prisma.InputJsonValue),
    },
  });
}

/**
 * First successful write creates LeadAttribution + FIRST history.
 * P2002 on leadId unique → subsequent touch: append history, update lastTouch* only.
 */
export async function captureTouch(input: CaptureTouchInput): Promise<void> {
  const db = input.db ?? defaultPrisma;
  const at = input.capturedAt ?? new Date();
  const matched = await resolveCampaign(
    { campaignId: input.campaignId, utmCampaign: utmCampaignRaw(input.utm ?? undefined) },
    db,
  );
  const campaignId = resolveCampaignIdRule({
    campaignId: input.campaignId ?? null,
    utmCampaign: utmCampaignRaw(input.utm ?? undefined),
    matchedCodeId: matched,
  });
  const fields = fieldsFromInput(input, campaignId);

  try {
    await db.$transaction(async (tx) => {
      await tx.leadAttribution.create({
        data: {
          leadId: input.leadId,
          ...attributionWrite(fields, at),
        },
      });
      await tx.leadAttributionHistory.create({
        data: historyWrite(input.leadId, fields, at, true),
      });
    });
  } catch (err) {
    if (!isP2002(err)) throw err;
    await db.$transaction(async (tx) => {
      await lockAttributionRow(tx, input.leadId);
      await tx.leadAttributionHistory.create({
        data: historyWrite(input.leadId, fields, at, false),
      });
      await applyLastTouchFromLatestHistory(tx, input.leadId);
    });
  }
}

export function touchInputFromLeadCreate(lead: {
  id: string;
  source: string;
  sourceMetadata: unknown;
  capturedAt: Date;
}): CaptureTouchInput {
  const meta =
    lead.sourceMetadata && typeof lead.sourceMetadata === "object" && !Array.isArray(lead.sourceMetadata)
      ? (lead.sourceMetadata as Record<string, unknown>)
      : {};
  const nestedUtm =
    meta.utm && typeof meta.utm === "object" && !Array.isArray(meta.utm)
      ? (meta.utm as Record<string, unknown>)
      : {};
  const utm: UtmBlob = preserveUtm({
    ...nestedUtm,
    campaign: (nestedUtm.campaign ?? nestedUtm.utm_campaign ?? meta.campaign ?? meta.utm_campaign) as string | undefined,
    source: (nestedUtm.source ?? nestedUtm.utm_source ?? meta.utm_source) as string | undefined,
    medium: (nestedUtm.medium ?? nestedUtm.utm_medium ?? meta.medium ?? meta.utm_medium) as string | undefined,
    term: (nestedUtm.term ?? nestedUtm.utm_term ?? meta.utm_term) as string | undefined,
    content: (nestedUtm.content ?? nestedUtm.utm_content ?? meta.utm_content) as string | undefined,
  });
  const source = (LEAD_SOURCES.has(lead.source) ? lead.source : DomainLeadSource.OTHER) as LeadSourceT;
  return {
    leadId: lead.id,
    source,
    campaignId: typeof meta.campaignId === "string" ? meta.campaignId : null,
    medium: typeof meta.medium === "string" ? meta.medium : typeof utm.medium === "string" ? utm.medium : null,
    channel: typeof meta.channel === "string" ? meta.channel : null,
    creativeRef: typeof meta.creativeRef === "string" ? meta.creativeRef : null,
    landingUrl: typeof meta.landingUrl === "string" ? meta.landingUrl : typeof meta.landingPage === "string" ? meta.landingPage : null,
    referralPartnerId: typeof meta.referralPartnerId === "string" ? meta.referralPartnerId : null,
    utm,
    capturedAt: lead.capturedAt,
  };
}

const LEAD_SOURCES = new Set<string>(Object.values(DomainLeadSource));

export type CacScope = "donor" | "recipient";

export type CacRow = {
  campaignId: string;
  code: string;
  name: string;
  actualSpendInr: string | null;
  leadCount: number;
  cac: number | null;
};

export async function computeCampaignCac(input: {
  actor: ActorContext;
  scope: CacScope;
  from?: Date | null;
  to?: Date | null;
  db?: Db;
}): Promise<CacRow[]> {
  const allowed = await actorHasPerm(input.actor, "analytics.view");
  if (!allowed) {
    throw new LeadPermissionDeniedError("Missing permission analytics.view", {
      permission: "analytics.view",
    });
  }
  const db = input.db ?? defaultPrisma;
  const personType = input.scope === "donor" ? "DONOR" : "RECIPIENT";
  const campaigns = await db.campaign.findMany({
    orderBy: { createdAt: "desc" },
  });
  const rows: CacRow[] = [];
  for (const c of campaigns) {
    const leadCount = await db.leadAttribution.count({
      where: {
        lastTouchCampaignId: c.id,
        ...(input.from || input.to
          ? {
              lastTouchAt: {
                gte: input.from ?? undefined,
                lte: input.to ?? undefined,
              },
            }
          : {}),
        lead: { personType },
      },
    });
    const spend = c.actualSpendInr != null ? Number(c.actualSpendInr) : 0;
    const cac = leadCount === 0 ? null : spend / leadCount;
    rows.push({
      campaignId: c.id,
      code: c.code,
      name: c.name,
      actualSpendInr: c.actualSpendInr != null ? c.actualSpendInr.toString() : null,
      leadCount,
      cac,
    });
  }
  return rows;
}
