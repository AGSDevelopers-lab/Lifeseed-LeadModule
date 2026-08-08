import { CycleEventType } from "@prisma/client";

export const WITNESS_REQUIRED: CycleEventType[] = [
  CycleEventType.OPU_COMPLETED,
  CycleEventType.FERTILIZATION,
  CycleEventType.VITRIFICATION,
  CycleEventType.TRANSFER,
];

export const CYCLE_EVENT_LABEL: Record<CycleEventType, string> = {
  STIM_MONITORING: "Stim monitoring",
  OPU_COMPLETED: "OPU completed",
  OOCYTES_RETRIEVED: "Oocytes retrieved",
  FERTILIZATION: "Fertilization",
  DAY1_CHECK: "Day-1 check (2PN)",
  DAY3_GRADE: "Day-3 grade",
  DAY5_GRADE: "Day-5 Gardner",
  PGT_RESULT: "PGT result",
  TRANSFER: "Embryo transfer",
  VITRIFICATION: "Vitrification",
  BETA_HCG: "Beta-hCG",
  CLINICAL_PREGNANCY: "Clinical pregnancy",
  LIVE_BIRTH: "Live birth",
  CYCLE_CANCELLED: "Cycle cancelled",
};

const PHASE_NEXT: Record<string, CycleEventType> = {
  E0: CycleEventType.STIM_MONITORING,
  E1: CycleEventType.OPU_COMPLETED,
  E2: CycleEventType.OOCYTES_RETRIEVED,
  E3: CycleEventType.FERTILIZATION,
  E4: CycleEventType.DAY1_CHECK,
  E5: CycleEventType.TRANSFER,
  E6: CycleEventType.TRANSFER,
  E7: CycleEventType.BETA_HCG,
  E8: CycleEventType.BETA_HCG,
  E9: CycleEventType.LIVE_BIRTH,
};

export function nextExpectedEvent(phase: string): CycleEventType {
  return PHASE_NEXT[phase] ?? CycleEventType.STIM_MONITORING;
}

export const ACTIVE_CYCLE_STATES = [
  "ALLOCATED",
  "IN_TRANSIT",
  "DELIVERED",
  "IN_CYCLE",
  "OUTCOME_PENDING",
] as const;
