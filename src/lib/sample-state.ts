import {
  SampleState,
  type Prisma,
  type Sample,
  type SampleReleaseTiming,
} from "@prisma/client";

import { audit } from "@/lib/audit";
import { prisma } from "@/lib/db";
import { getQcGateConfig, type QcGateName } from "@/lib/qc-config";

export const SAMPLE_STATE_ORDER: SampleState[] = [
  SampleState.DRAFT,
  SampleState.ACCESSIONED,
  SampleState.ANALYZED,
  SampleState.ADVANCED_TESTING,
  SampleState.DECIDED,
  SampleState.PREPARED,
  SampleState.VIALED,
  SampleState.CRYOPRESERVED,
  SampleState.QC_A5_PENDING,
  SampleState.QUARANTINE,
  SampleState.POST_THAW_ANALYZED,
  SampleState.CLOSED,
];

export const SAMPLE_STATE_LABEL: Record<SampleState, string> = {
  DRAFT: "Draft",
  ACCESSIONED: "Accessioned",
  ANALYZED: "Analyzed",
  ADVANCED_TESTING: "Advanced tests",
  DECIDED: "Decided",
  PREPARED: "Prepared",
  VIALED: "Vialed",
  CRYOPRESERVED: "Cryopreserved",
  QC_A5_PENDING: "QC-A5 pending",
  QUARANTINE: "Quarantine",
  POST_THAW_ANALYZED: "Post-thaw analyzed",
  CLOSED: "Closed",
};

/** Legal forward edges in the andrology state machine. */
const EDGES: Partial<Record<SampleState, SampleState[]>> = {
  DRAFT: [SampleState.ACCESSIONED, SampleState.CLOSED],
  ACCESSIONED: [SampleState.ANALYZED, SampleState.CLOSED],
  ANALYZED: [SampleState.ADVANCED_TESTING, SampleState.DECIDED, SampleState.CLOSED],
  ADVANCED_TESTING: [SampleState.DECIDED, SampleState.CLOSED],
  DECIDED: [SampleState.PREPARED, SampleState.CLOSED],
  PREPARED: [SampleState.VIALED, SampleState.CLOSED],
  VIALED: [SampleState.CRYOPRESERVED, SampleState.CLOSED],
  CRYOPRESERVED: [SampleState.QC_A5_PENDING, SampleState.CLOSED],
  QC_A5_PENDING: [
    SampleState.QUARANTINE,
    SampleState.POST_THAW_ANALYZED,
    SampleState.CLOSED,
  ],
  QUARANTINE: [SampleState.POST_THAW_ANALYZED, SampleState.CLOSED],
  POST_THAW_ANALYZED: [SampleState.CLOSED],
  CLOSED: [],
};

export function canAdvanceSample(
  sample: Pick<Sample, "state" | "releaseTiming">,
  targetState: SampleState,
): boolean {
  if (sample.state === targetState) return true;
  const allowed = EDGES[sample.state] ?? [];
  if (!allowed.includes(targetState)) return false;

  // Quarantine path only when releaseTiming=QUARANTINE
  if (
    targetState === SampleState.QUARANTINE &&
    sample.releaseTiming !== ("QUARANTINE" as SampleReleaseTiming)
  ) {
    return false;
  }
  return true;
}

export type AdvanceSampleContext = {
  actorUserId: string;
  reason?: string;
  data?: Record<string, unknown>;
  witnesses?: string[];
};

export async function advanceSample(
  sampleId: string,
  targetState: SampleState,
  actor: AdvanceSampleContext,
): Promise<Sample> {
  const sample = await prisma.sample.findUniqueOrThrow({
    where: { id: sampleId },
  });

  if (!canAdvanceSample(sample, targetState)) {
    throw new Error(
      `Illegal sample transition: ${sample.state} → ${targetState}`,
    );
  }

  const before = { state: sample.state };
  const updated = await prisma.sample.update({
    where: { id: sampleId },
    data: {
      state: targetState,
      ...(actor.data as object),
      ...(targetState === SampleState.QUARANTINE
        ? {
            quarantineStartDate: new Date(),
            quarantineEndDate: new Date(
              Date.now() + 180 * 24 * 60 * 60 * 1000,
            ),
          }
        : {}),
    },
  });

  await audit.log({
    actorUserId: actor.actorUserId,
    action: "STATE_TRANSITION",
    entityType: "Sample",
    entityId: sampleId,
    sampleRelId: sampleId,
    beforeJson: before,
    afterJson: {
      state: updated.state,
      reason: actor.reason ?? null,
      witnesses: actor.witnesses ?? [],
    },
  });

  return updated;
}

export type QcGateResult = {
  gate: QcGateName;
  passed: boolean;
  details: Record<string, unknown>;
};

const DEFAULT_QC_A2 = {
  volumeMin: 1.5,
  concMin: 40,
  prMin: 40,
  totalMotMin: 50,
  morphMin: 4,
  vitalityMin: 60,
};

const DEFAULT_QC_A5 = {
  prRecoveryMinPct: 40,
  totalMotileMinM: 20,
  vitalityMin: 50,
};

export async function runQcGate(
  sample: Sample,
  gateNumber: 1 | 2 | 3 | 4 | 5 | 6,
  results: Record<string, unknown>,
  actorUserId: string,
): Promise<QcGateResult> {
  const gateName = `QC_A${gateNumber}` as QcGateName;
  const cfg = await getQcGateConfig(sample.siteId, gateName);

  // QC-A6 is ICMR statutory — never skip evaluation when called
  if (!cfg.isEnabled && gateNumber !== 6) {
    const skipped: QcGateResult = {
      gate: gateName,
      passed: true,
      details: { skipped: true, reason: "Gate disabled for site" },
    };
    await audit.log({
      actorUserId,
      action: "APPROVE",
      entityType: "Sample",
      entityId: sample.id,
      sampleRelId: sample.id,
      afterJson: skipped as unknown as Prisma.InputJsonValue,
    });
    return skipped;
  }

  let passed = false;
  const details: Record<string, unknown> = { ...results };

  switch (gateNumber) {
    case 1: {
      passed = Boolean(
        results.containerIntact &&
          results.idMatch &&
          results.timeUnder30min &&
          results.completeEjaculate,
      );
      break;
    }
    case 2: {
      const t = { ...DEFAULT_QC_A2, ...(cfg.thresholdOverrides as object) };
      const volume = Number(results.volumeML ?? sample.volumeML ?? 0);
      const conc = Number(
        results.concentrationMPerML ?? sample.concentrationMPerML ?? 0,
      );
      const pr = Number(
        results.progressiveMotilityPct ?? sample.progressiveMotilityPct ?? 0,
      );
      const total = Number(
        results.totalMotilityPct ?? sample.totalMotilityPct ?? 0,
      );
      const morph = Number(
        results.morphologyNormalPct ?? sample.morphologyNormalPct ?? 0,
      );
      const vit = Number(results.vitalityPct ?? sample.vitalityPct ?? 0);
      passed =
        volume >= t.volumeMin &&
        conc >= t.concMin &&
        pr >= t.prMin &&
        total >= t.totalMotMin &&
        morph >= t.morphMin &&
        vit >= t.vitalityMin;
      details.thresholds = t;
      break;
    }
    case 5: {
      const t = { ...DEFAULT_QC_A5, ...(cfg.thresholdOverrides as object) };
      const preFreeze = Number(sample.progressiveMotilityPct ?? 0);
      const postThaw = Number(
        results.postThawPR ?? sample.testVialThawResult ?? 0,
      );
      const totalMotile = Number(results.totalMotilePerVial ?? 0);
      const recoveryOk =
        preFreeze <= 0
          ? false
          : (postThaw / preFreeze) * 100 >= t.prRecoveryMinPct;
      passed = recoveryOk && totalMotile >= t.totalMotileMinM;
      details.thresholds = t;
      details.recoveryPct =
        preFreeze > 0 ? (postThaw / preFreeze) * 100 : null;
      break;
    }
    case 6: {
      const panel = [
        "HIV_I_II",
        "HBSAG",
        "HCV",
        "VDRL",
        "HTLV",
        "CMV_IGM",
      ];
      passed = panel.every((code) => results[code] === "NEG");
      break;
    }
    default:
      passed = Boolean(results.passed ?? true);
  }

  const out: QcGateResult = { gate: gateName, passed, details };
  await audit.log({
    actorUserId,
    action: passed ? "APPROVE" : "UPDATE",
    entityType: "Sample",
    entityId: sample.id,
    sampleRelId: sample.id,
    afterJson: out as unknown as Prisma.InputJsonValue,
  });
  return out;
}

export function categoryPrefix(
  category: "PREMIUM" | "STANDARD" | "ECONOMY" | null | undefined,
): "PRM" | "STD" | "ECN" {
  if (category === "PREMIUM") return "PRM";
  if (category === "ECONOMY") return "ECN";
  return "STD";
}

export async function nextSampleCode(
  siteId: string,
  category: "PREMIUM" | "STANDARD" | "ECONOMY" | null,
): Promise<string> {
  const prefix = categoryPrefix(category);
  const yyMm = new Date().toISOString().slice(2, 7).replace("-", "");
  const stub = `SMP-${prefix}-${yyMm}-`;
  const latest = await prisma.sample.findFirst({
    where: { sampleCode: { startsWith: stub }, siteId },
    orderBy: { sampleCode: "desc" },
    select: { sampleCode: true },
  });
  const seq = latest
    ? Number(latest.sampleCode.slice(stub.length)) + 1
    : 1;
  return `${stub}${String(seq).padStart(5, "0")}`;
}
