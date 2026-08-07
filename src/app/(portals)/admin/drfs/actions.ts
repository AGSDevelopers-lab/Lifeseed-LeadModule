"use server";

import {
  DispatchOrderState,
  DispatchType,
  DonorType,
  DrfState,
  SampleCategory,
  SampleGrade,
  SamplePriority,
  type Prisma,
} from "@prisma/client";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { audit } from "@/lib/audit";
import { raiseChallan } from "@/lib/challan-invoice";
import { prisma } from "@/lib/db";
import {
  advanceDrf,
  nextDispatchNumber,
  nextDrfNumber,
} from "@/lib/drf-state";
import { requirePermission } from "@/lib/rbac";
import { logAttestation } from "@/lib/witness";

export type ActionResult =
  | { ok: true; id?: string }
  | { ok: false; error: string };

function catchPerm(err: unknown): ActionResult {
  if (err instanceof Response) {
    return {
      ok: false,
      error: err.status === 401 ? "Unauthorized" : "Forbidden",
    };
  }
  if (err instanceof Error) return { ok: false, error: err.message };
  return { ok: false, error: "Unexpected error" };
}

function donorTypeFor(type: DispatchType): DonorType {
  if (type === DispatchType.SEMEN_VIAL || type === DispatchType.ANCILLARY_SUPPLIES) {
    return DonorType.SEMEN;
  }
  return DonorType.OOCYTE;
}

const createSchema = z.object({
  clinicId: z.string().min(1),
  siteId: z.string().min(1),
  type: z.nativeEnum(DispatchType),
  priority: z.nativeEnum(SamplePriority),
  requestedQuantity: z.number().int().min(1).max(100),
  filterCategory: z.nativeEnum(SampleCategory).optional().nullable(),
  filterGrade: z.nativeEnum(SampleGrade).optional().nullable(),
  notes: z.string().optional(),
  expectedDeliveryAt: z.string().optional(),
  recipientId: z.string().optional().nullable(),
});

export async function createDrf(
  input: z.infer<typeof createSchema>,
): Promise<ActionResult> {
  try {
    const session = await requirePermission("drf.create");
    const parsed = createSchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: "Validation failed" };
    const d = parsed.data;

    // Clinic users may only create for their own clinic
    if (session.clinicId && session.clinicId !== d.clinicId) {
      return { ok: false, error: "Cannot create DRF for another clinic" };
    }

    const clinic = await prisma.clinic.findUniqueOrThrow({
      where: { id: d.clinicId },
      include: { contract: true },
    });

    const drfNumber = await nextDrfNumber(clinic.clinicCode);
    const drf = await prisma.dRF.create({
      data: {
        drfNumber,
        clinicId: d.clinicId,
        siteId: d.siteId,
        recipientId: d.recipientId || null,
        type: d.type,
        priority: d.priority,
        donorType: donorTypeFor(d.type),
        requestedQuantity: d.requestedQuantity,
        filterCategory: d.filterCategory ?? null,
        filterGrade: d.filterGrade ?? null,
        notes: d.notes || null,
        expectedDeliveryAt: d.expectedDeliveryAt
          ? new Date(d.expectedDeliveryAt)
          : null,
        financialModelApplied: clinic.contract?.financialModel ?? "B",
        state: DrfState.DRAFT,
      },
    });

    await advanceDrf(drf.id, DrfState.SUBMITTED, {
      actorUserId: session.userId,
      reason: "DRF submitted",
    });

    revalidatePath("/admin/drfs");
    revalidatePath("/clinic/drfs");
    return { ok: true, id: drf.id };
  } catch (err) {
    return catchPerm(err);
  }
}

export async function acceptDrf(drfId: string): Promise<ActionResult> {
  try {
    const session = await requirePermission("drf.accept");
    await advanceDrf(drfId, DrfState.ACCEPTED, {
      actorUserId: session.userId,
      reason: "Bank accepted DRF",
    });
    revalidatePath(`/admin/drfs/${drfId}`);
    return { ok: true, id: drfId };
  } catch (err) {
    return catchPerm(err);
  }
}

export async function cancelDrf(drfId: string): Promise<ActionResult> {
  try {
    const session = await requirePermission("drf.cancel");
    await advanceDrf(drfId, DrfState.CANCELLED, {
      actorUserId: session.userId,
      reason: "Cancelled",
    });
    revalidatePath(`/admin/drfs/${drfId}`);
    return { ok: true, id: drfId };
  } catch (err) {
    return catchPerm(err);
  }
}

const allocateSchema = z.object({
  drfId: z.string().min(1),
  vialIds: z.array(z.string()).min(1),
  witnessUserId: z.string().min(1),
});

export async function allocateVials(
  input: z.infer<typeof allocateSchema>,
): Promise<ActionResult> {
  try {
    const session = await requirePermission("drf.allocate");
    const parsed = allocateSchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: "Validation failed" };
    const d = parsed.data;

    await logAttestation({
      action: "vial_allocation",
      entityType: "DRF",
      entityId: d.drfId,
      primaryUserId: session.userId,
      witnessUserId: d.witnessUserId,
    });

    const drf = await prisma.dRF.findUniqueOrThrow({
      where: { id: d.drfId },
      include: { site: true },
    });

    const vials = await prisma.vial.findMany({
      where: {
        id: { in: d.vialIds },
        isDiscarded: false,
        isDispensed: false,
        isReleased: true,
      },
    });
    if (vials.length !== d.vialIds.length) {
      return { ok: false, error: "One or more vials unavailable" };
    }

    const dispatchNumber = await nextDispatchNumber(drf.site.code);
    const dispatch = await prisma.dispatchOrder.create({
      data: {
        dispatchNumber,
        siteId: drf.siteId,
        clinicId: drf.clinicId,
        drfId: drf.id,
        type: drf.type,
        priority: drf.priority,
        state: DispatchOrderState.ALLOCATED,
        vialIds: d.vialIds,
        scheduledAt: drf.expectedDeliveryAt,
        chainOfCustodyLog: [
          {
            at: new Date().toISOString(),
            actorUserId: session.userId,
            action: "ALLOCATED",
            note: `Assigned ${d.vialIds.length} vial(s)`,
            witnessUserId: d.witnessUserId,
          },
        ] as Prisma.InputJsonValue,
      },
    });

    await prisma.vial.updateMany({
      where: { id: { in: d.vialIds } },
      data: {
        isDispensed: true,
        dispensedAt: new Date(),
        dispensedToDispatchId: dispatch.id,
      },
    });

    await advanceDrf(drf.id, DrfState.ALLOCATED, {
      actorUserId: session.userId,
      reason: "Vials allocated",
      data: { assignedVialIds: d.vialIds },
      witnesses: [session.userId, d.witnessUserId],
    });

    await audit.log({
      actorUserId: session.userId,
      action: "CREATE",
      entityType: "DispatchOrder",
      entityId: dispatch.id,
      afterJson: {
        dispatchNumber,
        drfId: drf.id,
        vialIds: d.vialIds,
      },
    });

    revalidatePath(`/admin/drfs/${drf.id}`);
    revalidatePath("/admin/dispatches");
    return { ok: true, id: dispatch.id };
  } catch (err) {
    return catchPerm(err);
  }
}

export async function dispatchDrf(
  drfId: string,
  witnessUserId: string,
): Promise<ActionResult> {
  try {
    const session = await requirePermission("drf.dispatch");
    await logAttestation({
      action: "dispatch_handoff",
      entityType: "DRF",
      entityId: drfId,
      primaryUserId: session.userId,
      witnessUserId,
    });

    const dispatch = await prisma.dispatchOrder.findFirst({
      where: { drfId, state: DispatchOrderState.ALLOCATED },
      orderBy: { createdAt: "desc" },
    });
    if (!dispatch) return { ok: false, error: "No allocated dispatch order" };

    const log = Array.isArray(dispatch.chainOfCustodyLog)
      ? [...(dispatch.chainOfCustodyLog as object[])]
      : [];
    log.push({
      at: new Date().toISOString(),
      actorUserId: session.userId,
      action: "HANDOFF_IN_TRANSIT",
      witnessUserId,
    });

    await prisma.dispatchOrder.update({
      where: { id: dispatch.id },
      data: {
        state: DispatchOrderState.IN_TRANSIT,
        dispatchedAt: new Date(),
        chainOfCustodyLog: log as Prisma.InputJsonValue,
      },
    });

    await advanceDrf(drfId, DrfState.IN_TRANSIT, {
      actorUserId: session.userId,
      reason: "Dispatched to courier",
      witnesses: [session.userId, witnessUserId],
    });

    // Challan-first: raise delivery challan at handoff (invoice converts on Delivered)
    try {
      await raiseChallan(drfId, session.userId);
    } catch {
      // GSTIN / SKU missing — delivery path will retry
    }

    revalidatePath(`/admin/drfs/${drfId}`);
    revalidatePath(`/admin/dispatches/${dispatch.id}`);
    revalidatePath("/admin/challans");
    return { ok: true, id: dispatch.id };
  } catch (err) {
    return catchPerm(err);
  }
}

export async function deliverDrf(
  drfId: string,
  witnessUserId: string,
): Promise<ActionResult> {
  try {
    const session = await requirePermission("drf.deliver");
    await logAttestation({
      action: "delivery_receipt",
      entityType: "DRF",
      entityId: drfId,
      primaryUserId: session.userId,
      witnessUserId,
    });

    const dispatch = await prisma.dispatchOrder.findFirst({
      where: { drfId, state: DispatchOrderState.IN_TRANSIT },
      orderBy: { createdAt: "desc" },
    });

    if (dispatch) {
      const log = Array.isArray(dispatch.chainOfCustodyLog)
        ? [...(dispatch.chainOfCustodyLog as object[])]
        : [];
      log.push({
        at: new Date().toISOString(),
        actorUserId: session.userId,
        action: "DELIVERED",
        witnessUserId,
      });
      await prisma.dispatchOrder.update({
        where: { id: dispatch.id },
        data: {
          state: DispatchOrderState.DELIVERED,
          deliveredAt: new Date(),
          chainOfCustodyLog: log as Prisma.InputJsonValue,
        },
      });
    }

    // Triggers challan→invoice conversion via advanceDrf
    await advanceDrf(drfId, DrfState.DELIVERED, {
      actorUserId: session.userId,
      reason: "Delivered — invoice raised from challan",
      witnesses: [session.userId, witnessUserId],
    });

    revalidatePath(`/admin/drfs/${drfId}`);
    revalidatePath("/admin/challans");
    revalidatePath("/admin/invoices");
    return { ok: true, id: drfId };
  } catch (err) {
    return catchPerm(err);
  }
}

export async function markInCycle(drfId: string): Promise<ActionResult> {
  try {
    const session = await requirePermission("drf.accept");
    await advanceDrf(drfId, DrfState.IN_CYCLE, {
      actorUserId: session.userId,
      reason: "Clinic reported in-cycle",
    });
    const dispatch = await prisma.dispatchOrder.findFirst({
      where: { drfId },
      orderBy: { createdAt: "desc" },
    });
    if (dispatch) {
      await prisma.dispatchOrder.update({
        where: { id: dispatch.id },
        data: { state: DispatchOrderState.IN_CYCLE, receivedAt: new Date() },
      });
    }
    revalidatePath(`/admin/drfs/${drfId}`);
    return { ok: true };
  } catch (err) {
    return catchPerm(err);
  }
}

export async function reportOutcome(
  drfId: string,
  outcomeType: string,
): Promise<ActionResult> {
  try {
    let session;
    try {
      session = await requirePermission("cycle_outcome.log");
    } catch {
      session = await requirePermission("drf.accept");
    }
    await advanceDrf(drfId, DrfState.OUTCOME_PENDING, {
      actorUserId: session.userId,
      reason: "Outcome reported",
      data: { outcomeType },
    });
    await advanceDrf(drfId, DrfState.CLOSED, {
      actorUserId: session.userId,
      reason: "DRF closed after outcome",
    });
    revalidatePath(`/admin/drfs/${drfId}`);
    revalidatePath(`/clinic/drfs/${drfId}`);
    return { ok: true };
  } catch (err) {
    return catchPerm(err);
  }
}

export async function updateDispatchTracking(input: {
  dispatchId: string;
  courierVendor?: string;
  courierTrackingId?: string;
}): Promise<ActionResult> {
  try {
    const session = await requirePermission("dispatch.update");
    await prisma.dispatchOrder.update({
      where: { id: input.dispatchId },
      data: {
        courierVendor: input.courierVendor || undefined,
        courierTrackingId: input.courierTrackingId || undefined,
      },
    });
    await audit.log({
      actorUserId: session.userId,
      action: "UPDATE",
      entityType: "DispatchOrder",
      entityId: input.dispatchId,
      afterJson: {
        courierVendor: input.courierVendor ?? null,
        courierTrackingId: input.courierTrackingId ?? null,
      },
    });
    revalidatePath(`/admin/dispatches/${input.dispatchId}`);
    return { ok: true };
  } catch (err) {
    return catchPerm(err);
  }
}

export async function markDispatchDelivered(input: {
  dispatchId: string;
  witnessUserId: string;
}): Promise<ActionResult> {
  try {
    const session = await requirePermission("drf.deliver");
    const dispatch = await prisma.dispatchOrder.findUniqueOrThrow({
      where: { id: input.dispatchId },
    });
    if (!dispatch.drfId) {
      return { ok: false, error: "Dispatch has no linked DRF" };
    }
    return deliverDrf(dispatch.drfId, input.witnessUserId);
  } catch (err) {
    return catchPerm(err);
  }
}
