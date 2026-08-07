import {
  DrfState,
  type DRF,
  type Prisma,
} from "@prisma/client";

import { audit } from "@/lib/audit";
import { convertChallanToInvoice, raiseChallan } from "@/lib/challan-invoice";
import { prisma } from "@/lib/db";

export const DRF_STATE_LABEL: Record<DrfState, string> = {
  DRAFT: "Draft",
  SUBMITTED: "Submitted",
  ACCEPTED: "Accepted",
  ALLOCATED: "Allocated",
  IN_TRANSIT: "In transit",
  DELIVERED: "Delivered",
  IN_CYCLE: "In cycle",
  OUTCOME_PENDING: "Outcome pending",
  CLOSED: "Closed",
  CANCELLED: "Cancelled",
};

const EDGES: Partial<Record<DrfState, DrfState[]>> = {
  DRAFT: [DrfState.SUBMITTED, DrfState.CANCELLED],
  SUBMITTED: [DrfState.ACCEPTED, DrfState.CANCELLED],
  ACCEPTED: [DrfState.ALLOCATED, DrfState.CANCELLED],
  ALLOCATED: [DrfState.IN_TRANSIT, DrfState.CANCELLED],
  IN_TRANSIT: [DrfState.DELIVERED, DrfState.CANCELLED],
  DELIVERED: [DrfState.IN_CYCLE],
  IN_CYCLE: [DrfState.OUTCOME_PENDING],
  OUTCOME_PENDING: [DrfState.CLOSED],
  CLOSED: [],
  CANCELLED: [],
};

/** Cancel allowed only before transit. */
const CANCELABLE: DrfState[] = [
  DrfState.DRAFT,
  DrfState.SUBMITTED,
  DrfState.ACCEPTED,
  DrfState.ALLOCATED,
];

export type DrfAdvanceActor = {
  actorUserId: string;
  reason?: string;
  data?: Record<string, unknown>;
  witnesses?: string[];
};

export function canAdvanceDrf(
  drf: Pick<DRF, "state">,
  targetState: DrfState,
  _actor?: { actorUserId: string },
): boolean {
  if (drf.state === targetState) return true;
  if (targetState === DrfState.CANCELLED) {
    return CANCELABLE.includes(drf.state);
  }
  const allowed = EDGES[drf.state] ?? [];
  return allowed.includes(targetState);
}

const EVENT_FOR_STATE: Partial<Record<DrfState, string>> = {
  SUBMITTED: "drf.submitted",
  ACCEPTED: "drf.accepted",
  ALLOCATED: "drf.allocated",
  IN_TRANSIT: "drf.dispatched",
  DELIVERED: "drf.delivered",
  IN_CYCLE: "drf.in_cycle",
  CLOSED: "drf.closed",
  CANCELLED: "drf.cancelled",
};

export async function emitDrfEvent(
  eventName: string,
  payload: Record<string, unknown>,
): Promise<void> {
  await prisma.eventEmission.create({
    data: {
      eventName,
      payload: payload as Prisma.InputJsonValue,
      targetSystem: "INTERNAL",
      consumerStatus: "PENDING",
    },
  });
}

export async function advanceDrf(
  drfId: string,
  targetState: DrfState,
  actor: DrfAdvanceActor,
  options?: { skipInvoice?: boolean },
): Promise<DRF> {
  const drf = await prisma.dRF.findUniqueOrThrow({ where: { id: drfId } });

  if (!canAdvanceDrf(drf, targetState, actor)) {
    throw new Error(`Illegal DRF transition: ${drf.state} → ${targetState}`);
  }

  const stamp: Record<string, unknown> = { ...(actor.data ?? {}) };
  if (targetState === DrfState.SUBMITTED) stamp.submittedAt = new Date();
  if (targetState === DrfState.ACCEPTED) stamp.acceptedAt = new Date();
  if (targetState === DrfState.ALLOCATED) stamp.allocatedAt = new Date();
  if (targetState === DrfState.IN_TRANSIT) stamp.dispatchedAt = new Date();
  if (targetState === DrfState.DELIVERED) stamp.deliveredAt = new Date();
  if (targetState === DrfState.OUTCOME_PENDING) {
    stamp.outcomeReportedAt = new Date();
  }

  const before = { state: drf.state };
  const updated = await prisma.dRF.update({
    where: { id: drfId },
    data: {
      state: targetState,
      ...(stamp as object),
    },
  });

  await audit.log({
    actorUserId: actor.actorUserId,
    action: "STATE_TRANSITION",
    entityType: "DRF",
    entityId: drfId,
    beforeJson: before,
    afterJson: {
      state: updated.state,
      reason: actor.reason ?? null,
      witnesses: actor.witnesses ?? [],
      event: EVENT_FOR_STATE[targetState] ?? null,
    } as Prisma.InputJsonValue,
  });

  const eventName = EVENT_FOR_STATE[targetState];
  if (eventName) {
    await emitDrfEvent(eventName, {
      drfId,
      drfNumber: updated.drfNumber,
      state: updated.state,
      actorUserId: actor.actorUserId,
    });
  }

  // Challan-first: Delivered → convert challan → invoice.raised
  if (targetState === DrfState.DELIVERED && !options?.skipInvoice) {
    const existing = await prisma.challan.findFirst({
      where: {
        drfId,
        status: { in: ["RAISED", "ACKNOWLEDGED"] },
      },
      orderBy: { issuedAt: "desc" },
    });
    const challan =
      existing ??
      (await raiseChallan(drfId, actor.actorUserId));
    await convertChallanToInvoice(challan.id, actor.actorUserId);
    await emitDrfEvent("invoice.raised", {
      drfId,
      challanId: challan.id,
    });
  }

  return updated;
}

export async function nextDrfNumber(clinicCode: string): Promise<string> {
  const ymd = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const stub = `LIF-${clinicCode}-DRF-${ymd}-`;
  const latest = await prisma.dRF.findFirst({
    where: { drfNumber: { startsWith: stub } },
    orderBy: { drfNumber: "desc" },
    select: { drfNumber: true },
  });
  const seq = latest ? Number(latest.drfNumber.slice(stub.length)) + 1 : 1;
  return `${stub}${String(seq).padStart(4, "0")}`;
}

export async function nextDispatchNumber(siteCode: string): Promise<string> {
  const ymd = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const stub = `LIF-${siteCode}-DSP-${ymd}-`;
  const latest = await prisma.dispatchOrder.findFirst({
    where: { dispatchNumber: { startsWith: stub } },
    orderBy: { dispatchNumber: "desc" },
    select: { dispatchNumber: true },
  });
  const seq = latest
    ? Number(latest.dispatchNumber.slice(stub.length)) + 1
    : 1;
  return `${stub}${String(seq).padStart(4, "0")}`;
}
