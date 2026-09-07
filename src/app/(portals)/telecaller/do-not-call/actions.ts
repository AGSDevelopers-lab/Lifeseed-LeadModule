"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { audit } from "@/lib/audit";
import { addDnc, removeDnc } from "@/lib/leads/application/dnc";
import { DncChannel, DncSource } from "@/lib/leads/domain/enums";
import { requirePermission } from "@/lib/rbac";

export type DncActionResult =
  | { ok: true; id: string }
  | { ok: false; error: string };

const addSchema = z.object({
  channel: z.enum(["PHONE", "EMAIL", "WHATSAPP", "SMS", "ALL"]),
  value: z.string().min(1),
  reason: z.string().min(1),
  source: z
    .enum([
      "SELF_REQUEST",
      "OPS_ADD",
      "COMPLIANCE_ADD",
      "LEAD_REQUEST",
      "REGULATOR",
      "SYSTEM",
      "UNSUBSCRIBE_LINK",
      "MANUAL",
    ])
    .default("MANUAL"),
});

const removeSchema = z.object({
  id: z.string().min(1),
  authorityNote: z.string().min(1),
});

function catchErr(err: unknown): DncActionResult {
  if (err instanceof Response) {
    return { ok: false, error: err.status === 401 ? "Unauthorized" : "Forbidden" };
  }
  if (err instanceof Error) return { ok: false, error: err.message };
  return { ok: false, error: "Unexpected error" };
}

function revalidateDncPages() {
  revalidatePath("/telecaller/do-not-call");
  revalidatePath("/admin/leads/do-not-call");
}

export async function addDncEntry(input: {
  channel: string;
  value: string;
  reason: string;
  source?: string;
}): Promise<DncActionResult> {
  try {
    const session = await requirePermission("dnc.add");
    const parsed = addSchema.safeParse(input);
    if (!parsed.success) {
      return { ok: false, error: "Channel, value, and reason are required" };
    }
    const row = await addDnc({
      channel: parsed.data.channel as (typeof DncChannel)[keyof typeof DncChannel],
      value: parsed.data.value,
      reason: parsed.data.reason,
      source: parsed.data.source as (typeof DncSource)[keyof typeof DncSource],
      createdByUserId: session.userId,
    });
    await audit.log({
      actorUserId: session.userId,
      action: "dnc.add",
      entityType: "LeadDoNotCall",
      entityId: row.id,
      afterJson: { channel: row.channel, normalisedValue: row.normalisedValue },
    });
    revalidateDncPages();
    return { ok: true, id: row.id };
  } catch (e) {
    return catchErr(e);
  }
}

export async function removeDncEntry(input: {
  id: string;
  authorityNote: string;
}): Promise<DncActionResult> {
  try {
    const session = await requirePermission("dnc.remove");
    const parsed = removeSchema.safeParse(input);
    if (!parsed.success) {
      return { ok: false, error: "Authority note is required" };
    }
    const row = await removeDnc(parsed.data.id, {
      authorityUserId: session.userId,
      authorityNote: parsed.data.authorityNote,
    });
    await audit.log({
      actorUserId: session.userId,
      action: "dnc.remove",
      entityType: "LeadDoNotCall",
      entityId: row.id,
      afterJson: { removalNote: parsed.data.authorityNote },
    });
    revalidateDncPages();
    return { ok: true, id: row.id };
  } catch (e) {
    return catchErr(e);
  }
}
