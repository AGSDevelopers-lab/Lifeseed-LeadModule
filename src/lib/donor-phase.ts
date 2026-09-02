import {
  DonorPhase,
  DonorStatus,
  type Donor,
  type RejectionCode,
  type SeedScoreTier,
} from "@prisma/client";

import { audit } from "@/lib/audit";
import { prisma } from "@/lib/db";

export const PHASE_ORDER: DonorPhase[] = [
  DonorPhase.P0_INTAKE,
  DonorPhase.P1_SCREENING,
  DonorPhase.P2_ACTIVE,
  DonorPhase.P3_DRF,
  DonorPhase.P4_OUTCOME,
];

export const PHASE_LABEL: Record<DonorPhase, string> = {
  P0_INTAKE: "P0 · Intake",
  P1_SCREENING: "P1 · Screening",
  P2_ACTIVE: "P2 · Active",
  P3_DRF: "P3 · DRF",
  P4_OUTCOME: "P4 · Outcome",
};

export const REJECTION_CODE_LABEL: Record<RejectionCode, string> = {
  REG_AGE: "Age outside statutory range",
  REG_MAR: "Marital status requirement not met",
  REG_CHILD: "Living child requirement not met (oocyte)",
  OPS_KYC: "KYC / identity verification failed",
  OPS_DUP: "Duplicate registration detected",
  OPS_GEO: "Geographic / site eligibility failed",
  WDR_VOL: "Voluntary withdrawal",
  MED_INF: "Medical / infectious disease flag",
  MED_PHY: "Physical examination unfit",
  GEN_HX: "Genetic history concern",
  SEROLOGY_POSITIVE: "Mandatory serology positive",
};

/** Codes that may be used for temporary deferral (not permanent rejection). */
export const DEFERRABLE_CODES: RejectionCode[] = [
  "REG_AGE",
  "OPS_KYC",
  "OPS_GEO",
  "MED_INF",
  "MED_PHY",
  "GEN_HX",
];

export const ICMR_SEROLOGY_TESTS = [
  { code: "HIV_I_II", label: "HIV I / II" },
  { code: "HBSAG", label: "HBsAg" },
  { code: "HCV", label: "HCV" },
  { code: "VDRL", label: "VDRL" },
  { code: "HTLV", label: "HTLV" },
  { code: "CMV_IGM", label: "CMV IgM" },
] as const;

const TERMINAL_STATUSES: DonorStatus[] = [
  DonorStatus.REJECTED,
  DonorStatus.WITHDRAWN,
  DonorStatus.RETIRED,
];

function phaseIndex(phase: DonorPhase): number {
  return PHASE_ORDER.indexOf(phase);
}

/**
 * Guard: whether a donor may move to targetPhase.
 * Forward-only along P0→P4 unless already at/after target.
 * When SEEDSCORE_GATE_ENABLED=true, P1→P2 blocks NOT_RECOMMENDED (unless bypass).
 */
export function canAdvance(
  donor: Pick<Donor, "phase" | "status"> & {
    currentTier?: SeedScoreTier | null;
  },
  targetPhase: DonorPhase,
  opts?: { bypassSeedScoreGate?: boolean },
): boolean {
  return canAdvanceDetailed(donor, targetPhase, opts).canAdvance;
}

export function canAdvanceDetailed(
  donor: Pick<Donor, "phase" | "status"> & {
    currentTier?: SeedScoreTier | null;
  },
  targetPhase: DonorPhase,
  opts?: { bypassSeedScoreGate?: boolean },
): { canAdvance: boolean; reason?: string } {
  if (TERMINAL_STATUSES.includes(donor.status)) {
    return { canAdvance: false, reason: "Donor is in a terminal status" };
  }
  if (donor.status === DonorStatus.DEFERRED) {
    return { canAdvance: false, reason: "Donor is deferred" };
  }

  const from = phaseIndex(donor.phase);
  const to = phaseIndex(targetPhase);
  if (to < 0 || from < 0) {
    return { canAdvance: false, reason: "Unknown phase" };
  }

  let phaseOk = false;
  if (to === from) phaseOk = true;
  else if (to === from + 1) phaseOk = true;
  else if (
    donor.phase === DonorPhase.P1_SCREENING &&
    targetPhase === DonorPhase.P2_ACTIVE
  ) {
    phaseOk = true;
  }
  if (!phaseOk) {
    return {
      canAdvance: false,
      reason: `Illegal phase transition: ${donor.phase} → ${targetPhase}`,
    };
  }

  if (
    process.env.SEEDSCORE_GATE_ENABLED === "true" &&
    donor.phase === DonorPhase.P1_SCREENING &&
    targetPhase === DonorPhase.P2_ACTIVE &&
    donor.currentTier === "NOT_RECOMMENDED" &&
    !opts?.bypassSeedScoreGate
  ) {
    return {
      canAdvance: false,
      reason:
        "Donor has SeedScore tier Not Recommended (<55). BRM review required before P2 activation. Override via /admin/donors/[id]/override-seedscore-gate with permission seedscore.override.tier.",
    };
  }

  return { canAdvance: true };
}

export type AdvancePhaseContext = {
  actorUserId: string;
  reason?: string;
  setStatus?: DonorStatus;
  setPassport?: boolean;
  rejectionCode?: RejectionCode | null;
  deferredUntil?: Date | null;
  outcomeNotes?: string | null;
  /** When true + actor has seedscore.override.tier, skip NOT_RECOMMENDED P1→P2 gate. */
  bypassSeedScoreGate?: boolean;
};

/**
 * Advance donor phase with audit trail. Throws if transition illegal.
 */
export async function advancePhase(
  donorId: string,
  targetPhase: DonorPhase,
  actor: AdvancePhaseContext,
): Promise<Donor> {
  const donor = await prisma.donor.findUniqueOrThrow({ where: { id: donorId } });

  const gate = canAdvanceDetailed(donor, targetPhase, {
    bypassSeedScoreGate: actor.bypassSeedScoreGate,
  });
  if (!gate.canAdvance) {
    throw new Error(
      gate.reason ??
        `Illegal phase transition: ${donor.phase} → ${targetPhase} (status=${donor.status})`,
    );
  }

  const before = {
    phase: donor.phase,
    status: donor.status,
    passportIssuedAt: donor.passportIssuedAt,
    rejectionCode: donor.rejectionCode,
  };

  const data: {
    phase: DonorPhase;
    status?: DonorStatus;
    passportIssuedAt?: Date;
    rejectionCode?: RejectionCode | null;
    deferredUntil?: Date | null;
    outcomeNotes?: string | null;
  } = { phase: targetPhase };

  if (actor.setStatus) data.status = actor.setStatus;
  if (actor.setPassport) data.passportIssuedAt = new Date();
  if (actor.rejectionCode !== undefined) data.rejectionCode = actor.rejectionCode;
  if (actor.deferredUntil !== undefined) data.deferredUntil = actor.deferredUntil;
  if (actor.outcomeNotes !== undefined) data.outcomeNotes = actor.outcomeNotes;

  // Default status when entering Active pool
  if (targetPhase === DonorPhase.P2_ACTIVE && !actor.setStatus) {
    data.status = DonorStatus.ACTIVE;
    data.passportIssuedAt = data.passportIssuedAt ?? new Date();
  }

  const updated = await prisma.donor.update({
    where: { id: donorId },
    data,
  });

  await audit.log({
    actorUserId: actor.actorUserId,
    action: "STATE_TRANSITION",
    entityType: "Donor",
    entityId: donorId,
    donorRelId: donorId,
    beforeJson: before,
    afterJson: {
      phase: updated.phase,
      status: updated.status,
      passportIssuedAt: updated.passportIssuedAt,
      rejectionCode: updated.rejectionCode,
      reason: actor.reason ?? null,
    },
  });

  return updated;
}

export function nextActionLabel(
  donor: Pick<Donor, "phase" | "status" | "passportIssuedAt" | "deferredUntil"> & {
    _count?: { consents?: number; labTests?: number; samples?: number };
    consentsCount?: number;
    labTestsCount?: number;
  },
): string {
  if (donor.status === DonorStatus.REJECTED) return "Closed · rejected";
  if (donor.status === DonorStatus.DEFERRED) {
    return donor.deferredUntil
      ? `Review by ${donor.deferredUntil.toISOString().slice(0, 10)}`
      : "Deferred · awaiting review";
  }
  if (donor.status === DonorStatus.RETIRED) return "Retired";
  if (donor.status === DonorStatus.WITHDRAWN) return "Withdrawn";

  switch (donor.phase) {
    case DonorPhase.P0_INTAKE:
      return "Begin screening";
    case DonorPhase.P1_SCREENING:
      return "Complete consent / serology";
    case DonorPhase.P2_ACTIVE:
      return "Available for allocation";
    case DonorPhase.P3_DRF:
      return "Track DRF / outcome";
    case DonorPhase.P4_OUTCOME:
      return "Pathway complete";
    default:
      return "—";
  }
}
