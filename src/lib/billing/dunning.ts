import { DunningStage, InvoiceStatus, type Prisma } from "@prisma/client";

import { audit } from "@/lib/audit";
import { prisma } from "@/lib/db";

/** Days overdue thresholds (relative to due date). */
export const DUNNING_THRESHOLDS: Array<{
  stage: DunningStage;
  daysOverdue: number;
}> = [
  { stage: DunningStage.REMINDER_1, daysOverdue: 7 },
  { stage: DunningStage.REMINDER_2, daysOverdue: 15 },
  { stage: DunningStage.FINAL_NOTICE, daysOverdue: 30 },
  { stage: DunningStage.ESCALATED, daysOverdue: 45 },
];

const STAGE_ORDER: DunningStage[] = [
  DunningStage.NONE,
  DunningStage.REMINDER_1,
  DunningStage.REMINDER_2,
  DunningStage.FINAL_NOTICE,
  DunningStage.ESCALATED,
  DunningStage.WRITE_OFF,
];

export function daysOverdue(dueDate: Date, now = new Date()): number {
  const ms = now.getTime() - dueDate.getTime();
  return Math.floor(ms / (24 * 60 * 60 * 1000));
}

export function stageForDaysOverdue(days: number): DunningStage {
  if (days < 7) return DunningStage.NONE;
  let stage: DunningStage = DunningStage.NONE;
  for (const t of DUNNING_THRESHOLDS) {
    if (days >= t.daysOverdue) stage = t.stage;
  }
  return stage;
}

export function draftReminderEmail(input: {
  invoiceNumber: string;
  stage: DunningStage;
  daysOverdue: number;
  amount: string;
  clinicName?: string;
}): { subject: string; body: string } {
  const who = input.clinicName ?? "Customer";
  const subjects: Record<DunningStage, string> = {
    NONE: `Payment reminder — ${input.invoiceNumber}`,
    REMINDER_1: `Reminder: Invoice ${input.invoiceNumber} is ${input.daysOverdue}d overdue`,
    REMINDER_2: `Second notice: ${input.invoiceNumber} overdue`,
    FINAL_NOTICE: `Final notice — ${input.invoiceNumber} · dispatch hold may apply`,
    ESCALATED: `Escalation to collections — ${input.invoiceNumber}`,
    WRITE_OFF: `Write-off candidate — ${input.invoiceNumber}`,
  };
  return {
    subject: subjects[input.stage],
    body: [
      `Dear ${who},`,
      "",
      `Invoice ${input.invoiceNumber} for ₹${input.amount} is ${input.daysOverdue} day(s) past due.`,
      `Dunning stage: ${input.stage}.`,
      "",
      input.stage === DunningStage.FINAL_NOTICE ||
      input.stage === DunningStage.ESCALATED
        ? "New DRF fulfillment may be held until payment clears."
        : "Please arrange payment at the earliest.",
      "",
      "— LifeSeed Finance",
    ].join("\n"),
  };
}

export type DunningResult = {
  invoiceId: string;
  previous: DunningStage;
  next: DunningStage;
  advanced: boolean;
  daysOverdue: number;
  emailDraft: { subject: string; body: string } | null;
};

/**
 * Evaluate and optionally advance dunning stage for one invoice.
 */
export async function evaluateDunning(
  invoiceId: string,
  actorUserId?: string | null,
): Promise<DunningResult> {
  const invoice = await prisma.invoice.findUniqueOrThrow({
    where: { id: invoiceId },
  });

  if (
    invoice.status === InvoiceStatus.PAID_FULL ||
    invoice.status === InvoiceStatus.VOID ||
    invoice.status === InvoiceStatus.CREDITED
  ) {
    return {
      invoiceId,
      previous: invoice.dunningStage,
      next: invoice.dunningStage,
      advanced: false,
      daysOverdue: daysOverdue(invoice.dueDate),
      emailDraft: null,
    };
  }

  const overdue = daysOverdue(invoice.dueDate);
  const target = stageForDaysOverdue(overdue);
  const prevIdx = STAGE_ORDER.indexOf(invoice.dunningStage);
  const nextIdx = STAGE_ORDER.indexOf(target);
  const advanced = nextIdx > prevIdx;

  let emailDraft: { subject: string; body: string } | null = null;

  if (advanced || (target !== DunningStage.NONE && overdue >= 7)) {
    const clinic =
      invoice.buyerType === "CLINIC"
        ? await prisma.clinic.findUnique({ where: { id: invoice.buyerId } })
        : null;

    emailDraft = draftReminderEmail({
      invoiceNumber: invoice.invoiceNumber,
      stage: target,
      daysOverdue: overdue,
      amount: invoice.netPayable.toString(),
      clinicName: clinic?.name,
    });

    if (advanced) {
      await prisma.invoice.update({
        where: { id: invoiceId },
        data: {
          dunningStage: target,
          status:
            overdue > 0 && invoice.status === InvoiceStatus.RAISED
              ? InvoiceStatus.OVERDUE
              : invoice.status,
        },
      });

      await audit.log({
        actorUserId: actorUserId ?? null,
        action: "UPDATE",
        entityType: "Invoice",
        entityId: invoiceId,
        afterJson: {
          dunningStage: target,
          daysOverdue: overdue,
          emailSubject: emailDraft.subject,
        } as Prisma.InputJsonValue,
      });

      await prisma.eventEmission.create({
        data: {
          eventName: "dunning.advanced",
          payload: {
            invoiceId,
            stage: target,
            daysOverdue: overdue,
          } as Prisma.InputJsonValue,
          targetSystem: "INTERNAL",
          consumerStatus: "PENDING",
        },
      });
    }
  }

  return {
    invoiceId,
    previous: invoice.dunningStage,
    next: advanced ? target : invoice.dunningStage,
    advanced,
    daysOverdue: overdue,
    emailDraft,
  };
}

/** Bulk-evaluate all unpaid past-due invoices. */
export async function runDunningBatch(actorUserId: string): Promise<{
  evaluated: number;
  advanced: number;
}> {
  const now = new Date();
  const invoices = await prisma.invoice.findMany({
    where: {
      dueDate: { lt: now },
      status: {
        in: [
          InvoiceStatus.RAISED,
          InvoiceStatus.PAID_PARTIAL,
          InvoiceStatus.OVERDUE,
        ],
      },
    },
    select: { id: true },
    take: 500,
  });

  let advanced = 0;
  for (const inv of invoices) {
    const r = await evaluateDunning(inv.id, actorUserId);
    if (r.advanced) advanced += 1;
  }
  return { evaluated: invoices.length, advanced };
}
