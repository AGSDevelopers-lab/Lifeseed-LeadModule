"use server";

import { revalidatePath } from "next/cache";
import type { Prisma } from "@prisma/client";
import { z } from "zod";

import { audit } from "@/lib/audit";
import { prisma } from "@/lib/db";
import {
  ALL_QC_GATES,
  POST_THAW_PARAM_GATES,
  upsertQcGateConfig,
  type QcGateName,
} from "@/lib/qc-config";
import { requirePermission } from "@/lib/rbac";

export type ConfigActionResult =
  | { ok: true }
  | { ok: false; error: string };

function catchPerm(err: unknown): ConfigActionResult {
  if (err instanceof Response) {
    return {
      ok: false,
      error: err.status === 401 ? "Unauthorized" : "Forbidden",
    };
  }
  if (err instanceof Error) return { ok: false, error: err.message };
  return { ok: false, error: "Unexpected error" };
}

const gateSchema = z.object({
  siteId: z.string().min(1),
  gateName: z.string().min(1),
  isEnabled: z.boolean(),
  thresholdOverridesJson: z.string().optional(),
});

export async function saveQcGate(
  input: z.infer<typeof gateSchema>,
): Promise<ConfigActionResult> {
  try {
    const session = await requirePermission("sample.qc");
    const parsed = gateSchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: "Validation failed" };
    const d = parsed.data;

    const gateName = d.gateName as QcGateName;
    const allowed = new Set<string>([...ALL_QC_GATES, ...POST_THAW_PARAM_GATES]);
    if (!allowed.has(gateName)) {
      return { ok: false, error: "Unknown gate" };
    }

    let thresholdOverrides: Record<string, unknown> | null = null;
    if (d.thresholdOverridesJson && d.thresholdOverridesJson.trim()) {
      try {
        thresholdOverrides = JSON.parse(d.thresholdOverridesJson) as Record<
          string,
          unknown
        >;
      } catch {
        return { ok: false, error: "Invalid JSON for thresholds" };
      }
    }

    await upsertQcGateConfig({
      siteId: d.siteId,
      gateName,
      isEnabled: d.isEnabled,
      thresholdOverrides,
    });

    await audit.log({
      actorUserId: session.userId,
      action: "UPDATE",
      entityType: "QcGateConfig",
      entityId: `${d.siteId}:${gateName}`,
      afterJson: {
        gateName,
        isEnabled: d.isEnabled,
        thresholdOverrides,
      } as Prisma.InputJsonValue,
    });

    revalidatePath("/admin/config/qc-gates");
    return { ok: true };
  } catch (err) {
    return catchPerm(err);
  }
}

const categorySchema = z.object({
  siteId: z.string().min(1),
  rulesJson: z.string().min(2),
  tankMappingJson: z.string().min(2),
});

export async function saveCategoryRules(
  input: z.infer<typeof categorySchema>,
): Promise<ConfigActionResult> {
  try {
    const session = await requirePermission("sample.close");
    const parsed = categorySchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: "Validation failed" };
    const d = parsed.data;

    let rulesJson: unknown;
    let tankMappingJson: unknown;
    try {
      rulesJson = JSON.parse(d.rulesJson);
      tankMappingJson = JSON.parse(d.tankMappingJson);
    } catch {
      return { ok: false, error: "Invalid JSON" };
    }

    await prisma.categoryRuleConfig.upsert({
      where: { siteId: d.siteId },
      create: {
        siteId: d.siteId,
        rulesJson: rulesJson as Prisma.InputJsonValue,
        tankMappingJson: tankMappingJson as Prisma.InputJsonValue,
      },
      update: {
        rulesJson: rulesJson as Prisma.InputJsonValue,
        tankMappingJson: tankMappingJson as Prisma.InputJsonValue,
      },
    });

    await audit.log({
      actorUserId: session.userId,
      action: "UPDATE",
      entityType: "CategoryRuleConfig",
      entityId: d.siteId,
      afterJson: { rulesJson, tankMappingJson } as Prisma.InputJsonValue,
    });

    revalidatePath("/admin/config/categories");
    return { ok: true };
  } catch (err) {
    return catchPerm(err);
  }
}
