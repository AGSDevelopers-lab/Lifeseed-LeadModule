import { prisma } from "@/lib/db";

export type QcGateName =
  | "QC_A1"
  | "QC_A2"
  | "QC_A3"
  | "QC_A4"
  | "QC_A5"
  | "QC_A6"
  | "POST_THAW_CONC"
  | "POST_THAW_RAPID_PR"
  | "POST_THAW_SLOW_PR"
  | "POST_THAW_NON_PROG"
  | "POST_THAW_VITALITY"
  | "POST_THAW_MORPHOLOGY"
  | "POST_THAW_VOLUME";

export const ALL_QC_GATES: QcGateName[] = [
  "QC_A1",
  "QC_A2",
  "QC_A3",
  "QC_A4",
  "QC_A5",
  "QC_A6",
];

export const POST_THAW_PARAM_GATES: QcGateName[] = [
  "POST_THAW_CONC",
  "POST_THAW_RAPID_PR",
  "POST_THAW_SLOW_PR",
  "POST_THAW_NON_PROG",
  "POST_THAW_VITALITY",
  "POST_THAW_MORPHOLOGY",
  "POST_THAW_VOLUME",
];

export type QcGateConfigView = {
  gateName: QcGateName;
  isEnabled: boolean;
  thresholdOverrides: Record<string, unknown> | null;
  statutory: boolean;
};

export async function getQcGateConfig(
  siteId: string,
  gateName: QcGateName,
): Promise<QcGateConfigView> {
  const statutory = gateName === "QC_A6";
  const row = await prisma.qcGateConfig.findUnique({
    where: { siteId_gateName: { siteId, gateName } },
  });
  return {
    gateName,
    isEnabled: statutory ? true : (row?.isEnabled ?? true),
    thresholdOverrides: (row?.thresholdOverrides as Record<string, unknown>) ?? null,
    statutory,
  };
}

export async function listQcGateConfigs(
  siteId: string,
): Promise<QcGateConfigView[]> {
  const gates = [...ALL_QC_GATES, ...POST_THAW_PARAM_GATES];
  return Promise.all(gates.map((g) => getQcGateConfig(siteId, g)));
}

export async function upsertQcGateConfig(input: {
  siteId: string;
  gateName: QcGateName;
  isEnabled: boolean;
  thresholdOverrides?: Record<string, unknown> | null;
}): Promise<void> {
  if (input.gateName === "QC_A6" && !input.isEnabled) {
    throw new Error("QC-A6 is ICMR statutory and cannot be disabled");
  }
  await prisma.qcGateConfig.upsert({
    where: {
      siteId_gateName: { siteId: input.siteId, gateName: input.gateName },
    },
    create: {
      siteId: input.siteId,
      gateName: input.gateName,
      isEnabled: input.isEnabled,
      thresholdOverrides: input.thresholdOverrides ?? undefined,
    },
    update: {
      isEnabled: input.isEnabled,
      thresholdOverrides: input.thresholdOverrides ?? undefined,
    },
  });
}
