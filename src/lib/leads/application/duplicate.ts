import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/db";
import { ConfigStoreAdapter } from "@/lib/leads/adapters/config-store-adapter";
import { findDuplicateCandidates, loadDuplicateLeadSide } from "@/lib/leads/adapters/prisma-duplicate-store";
import { duplicateCaseToDomain } from "@/lib/leads/adapters/mappers/duplicate-case-mapper";
import { resolveConfigPayload } from "@/lib/leads/application/config-store";
import { isLeadDuplicateEnabled } from "@/lib/leads/application/feature-flag";
import { CONFIG_KEYS } from "@/lib/leads/config/keys";
import { DEFAULT_DUPLICATE_MATCH_RULES } from "@/lib/leads/config/defaults";
import type { DuplicateCase } from "@/lib/leads/domain/entities/DuplicateCase";
import { DupReviewStatus } from "@/lib/leads/domain/enums";
import {
  loadDuplicateMatchRules,
  matchLeadPair,
  type DuplicateMatchRules,
  type LeadMatchContact,
} from "@/lib/leads/domain/duplicate/match-rules";
import { LeadGuardFailedError } from "@/lib/leads/domain/errors";
import type { ActorContext } from "@/lib/leads/domain/ports/shared";

function orderedPair(a: string, b: string): { leftLeadId: string; rightLeadId: string } {
  return a < b ? { leftLeadId: a, rightLeadId: b } : { leftLeadId: b, rightLeadId: a };
}

export async function resolveMatchRules(): Promise<DuplicateMatchRules> {
  const adapter = new ConfigStoreAdapter(prisma);
  return resolveConfigPayload(
    adapter,
    CONFIG_KEYS.DUPLICATE_MATCH_RULES_V1,
    DEFAULT_DUPLICATE_MATCH_RULES,
  ).then((payload) =>
    loadDuplicateMatchRules({
      getActive: async () => payload as any,
      read: async () => payload as any,
      currentVersion: async () => 1,
      history: async () => [],
    }),
  );
}

export async function detectAndCreateDuplicateCases(
  incoming: LeadMatchContact,
  rulesOverride?: DuplicateMatchRules,
): Promise<DuplicateCase[]> {
  if (!isLeadDuplicateEnabled()) return [];
  const rules = rulesOverride ?? (await resolveMatchRules());
  const candidates = await findDuplicateCandidates(incoming);
  const created: DuplicateCase[] = [];
  const now = new Date();
  for (const candidate of candidates) {
    const match = matchLeadPair(incoming, candidate, rules);
    if (!match) continue;
    const pair = orderedPair(incoming.id, candidate.id);
    const existing = await prisma.duplicateCase.findFirst({
      where: {
        leftLeadId: pair.leftLeadId,
        rightLeadId: pair.rightLeadId,
        matchLevel: match.matchLevel,
      },
    });
    if (existing) {
      created.push(duplicateCaseToDomain(existing));
      continue;
    }
    const row = await prisma.duplicateCase.create({
      data: {
        leftLeadId: pair.leftLeadId,
        rightLeadId: pair.rightLeadId,
        matchLevel: match.matchLevel,
        matchSignals: match.matchSignals as Prisma.InputJsonValue,
        matchScore: match.matchScore,
        detectedAt: now,
        reviewStatus: DupReviewStatus.OPEN,
      },
    });
    created.push(duplicateCaseToDomain(row));
  }
  return created;
}

export async function listDuplicateCases(input?: {
  reviewStatus?: string;
  matchLevel?: string;
}): Promise<DuplicateCase[]> {
  const rows = await prisma.duplicateCase.findMany({
    where: {
      reviewStatus: input?.reviewStatus ? (input.reviewStatus as never) : undefined,
      matchLevel: input?.matchLevel ? (input.matchLevel as never) : undefined,
    },
    orderBy: { detectedAt: "desc" },
    take: 100,
  });
  return rows.map(duplicateCaseToDomain);
}

export async function getDuplicateCase(id: string) {
  const row = await prisma.duplicateCase.findUnique({ where: { id } });
  if (!row) return null;
  const [left, right] = await Promise.all([
    loadDuplicateLeadSide(row.leftLeadId),
    loadDuplicateLeadSide(row.rightLeadId),
  ]);
  return { case: duplicateCaseToDomain(row), left, right };
}

function assertOpen(status: string) {
  if (
    status === DupReviewStatus.MERGED ||
    status === DupReviewStatus.KEPT_SEPARATE ||
    status === DupReviewStatus.DISMISSED
  ) {
    throw new LeadGuardFailedError("Duplicate case is already resolved", { reviewStatus: status });
  }
}

export async function keepSeparateDuplicateCase(
  id: string,
  actor: ActorContext,
  notes?: string,
): Promise<DuplicateCase> {
  const row = await prisma.duplicateCase.findUnique({ where: { id } });
  if (!row) throw new LeadGuardFailedError("Duplicate case not found", { id });
  assertOpen(row.reviewStatus);
  const updated = await prisma.duplicateCase.update({
    where: { id },
    data: {
      reviewStatus: DupReviewStatus.KEPT_SEPARATE,
      reviewedByUserId: actor.userId,
      reviewedAt: new Date(),
      reviewNotes: notes ?? row.reviewNotes,
    },
  });
  return duplicateCaseToDomain(updated);
}

export async function dismissDuplicateCase(
  id: string,
  actor: ActorContext,
  notes?: string,
): Promise<DuplicateCase> {
  const row = await prisma.duplicateCase.findUnique({ where: { id } });
  if (!row) throw new LeadGuardFailedError("Duplicate case not found", { id });
  assertOpen(row.reviewStatus);
  const updated = await prisma.duplicateCase.update({
    where: { id },
    data: {
      reviewStatus: DupReviewStatus.DISMISSED,
      reviewedByUserId: actor.userId,
      reviewedAt: new Date(),
      reviewNotes: notes ?? row.reviewNotes,
    },
  });
  return duplicateCaseToDomain(updated);
}
