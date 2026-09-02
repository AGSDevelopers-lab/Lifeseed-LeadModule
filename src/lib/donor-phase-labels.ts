/**
 * Client-safe donor phase labels / constants.
 * Do NOT import prisma or Node-only modules here.
 */
import type { DonorPhase, RejectionCode } from "@prisma/client";

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
