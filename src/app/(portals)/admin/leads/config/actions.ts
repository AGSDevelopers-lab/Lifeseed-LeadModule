"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { audit } from "@/lib/audit";
import { prisma } from "@/lib/db";
import { getConfigStoreAdapter } from "@/lib/leads/adapters/config-store-adapter";
import {
  approveConfigVersion,
  assertConfigKey,
  ConfigSodViolationError,
  proposeConfigVersion,
} from "@/lib/leads/application/config-store";
import { canMutateConfigKey } from "@/lib/leads/config/ownership";
import { parseConfigPayload } from "@/lib/leads/config/schemas";
import { requirePermission } from "@/lib/rbac";

export type ConfigActionResult =
  | { ok: true; version: number }
  | { ok: false; error: string };

function catchErr(err: unknown): ConfigActionResult {
  if (err instanceof ConfigSodViolationError) {
    return { ok: false, error: err.message };
  }
  if (err instanceof Response) {
    return { ok: false, error: err.status === 401 ? "Unauthorized" : "Forbidden" };
  }
  if (err instanceof Error) return { ok: false, error: err.message };
  return { ok: false, error: "Unexpected error" };
}

export async function proposeLeadConfig(input: {
  key: string;
  payloadJson: string;
  notes?: string;
  effectiveFrom?: string;
}): Promise<ConfigActionResult> {
  try {
    const session = await requirePermission("lead.config.propose");
    const key = assertConfigKey(input.key);
    if (!canMutateConfigKey(session.roles, key)) {
      return { ok: false, error: "Your role cannot propose this key" };
    }
    let payload: unknown;
    try {
      payload = JSON.parse(input.payloadJson);
    } catch {
      return { ok: false, error: "Payload must be valid JSON" };
    }
    const parsed = parseConfigPayload(key, payload);
    if (!parsed.success) {
      return { ok: false, error: parsed.error.issues.map((i) => i.message).join("; ") };
    }
    const notes = z.string().optional().parse(input.notes);
    const row = await proposeConfigVersion(
      prisma,
      {
        key,
        payload: parsed.data,
        notes: notes || null,
        effectiveFrom: input.effectiveFrom ? new Date(input.effectiveFrom) : null,
        actorUserId: session.userId,
      },
      (e) => audit.log(e),
    );
    revalidatePath("/admin/leads/config");
    revalidatePath(`/admin/leads/config/${key}`);
    return { ok: true, version: row.version };
  } catch (e) {
    return catchErr(e);
  }
}

export async function approveLeadConfig(input: {
  key: string;
  version: number;
}): Promise<ConfigActionResult> {
  try {
    const session = await requirePermission("lead.config.approve");
    const key = assertConfigKey(input.key);
    if (!canMutateConfigKey(session.roles, key)) {
      return { ok: false, error: "Your role cannot approve this key" };
    }
    const row = await approveConfigVersion(
      prisma,
      { key, version: input.version, actorUserId: session.userId },
      (e) => audit.log(e),
      getConfigStoreAdapter(prisma),
    );
    revalidatePath("/admin/leads/config");
    revalidatePath(`/admin/leads/config/${key}`);
    return { ok: true, version: row.version };
  } catch (e) {
    return catchErr(e);
  }
}
