import { UserRole, type Donor, type SeedScoreTier } from "@prisma/client";

import {
  isSeedScoreVisibleToDonor,
  isSeedScoreVisibleToRecipient,
} from "@/lib/seedscore/constants";

export type SeedScoreVisibility = {
  showNumeric: boolean;
  showTier: boolean;
  showBreakdown: boolean;
};

const BANK_FULL: UserRole[] = [
  UserRole.BANK_SUPER_ADMIN,
  UserRole.BANK_BRM,
  UserRole.BANK_MEDICAL_DIRECTOR,
  UserRole.BANK_LAB_HEAD,
  UserRole.BANK_DONOR_COORD,
  UserRole.BANK_CLINICAL_REVIEWER,
  UserRole.BANK_MATCHING_OPS,
  UserRole.BANK_SITE_ADMIN,
];

const CLINIC_FULL: UserRole[] = [
  UserRole.CLINIC_DOCTOR,
  UserRole.CLINIC_COORDINATOR,
  UserRole.CLINIC_ADMIN,
  UserRole.L2_IVF_CLINICIAN,
];

/**
 * Role-based SeedScore surface control.
 * Recipient / donor visibility also gated by feature flags.
 *
 * TODO(recipient-portal): wire this helper wherever donor profiles are
 * surfaced to recipients (profile browse / package match). No recipient
 * donor surface exists yet — call getSeedScoreVisibility() when built.
 */
export function getSeedScoreVisibility(
  viewerRoles: UserRole[],
  viewerContext: {
    isSelf?: boolean;
    clinicOwnsDrf?: boolean;
  },
  _donor?: Pick<Donor, "id" | "currentTier"> | null,
): SeedScoreVisibility {
  if (viewerRoles.some((r) => BANK_FULL.includes(r))) {
    return { showNumeric: true, showTier: true, showBreakdown: true };
  }

  if (
    viewerRoles.some((r) => CLINIC_FULL.includes(r)) &&
    (viewerContext.clinicOwnsDrf || viewerContext.clinicOwnsDrf === undefined)
  ) {
    return { showNumeric: true, showTier: true, showBreakdown: true };
  }

  if (viewerContext.isSelf || viewerRoles.includes(UserRole.DONOR)) {
    if (!isSeedScoreVisibleToDonor()) {
      return { showNumeric: false, showTier: false, showBreakdown: false };
    }
    return { showNumeric: true, showTier: true, showBreakdown: true };
  }

  if (viewerRoles.includes(UserRole.RECIPIENT)) {
    if (!isSeedScoreVisibleToRecipient()) {
      return { showNumeric: false, showTier: false, showBreakdown: false };
    }
    return { showNumeric: true, showTier: true, showBreakdown: false };
  }

  return { showNumeric: false, showTier: false, showBreakdown: false };
}

export function tierBadgeClass(tier: SeedScoreTier | null | undefined): string {
  switch (tier) {
    case "PREMIUM":
      return "bg-emerald-100 text-emerald-900";
    case "STANDARD":
      return "bg-sky-100 text-sky-900";
    case "REGULAR":
      return "bg-amber-100 text-amber-900";
    case "NOT_RECOMMENDED":
      return "bg-red-100 text-red-900";
    default:
      return "bg-stone-100 text-stone-600";
  }
}
