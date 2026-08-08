"use server";

import {
  BillingFrequency,
  InvoiceStatus,
  PaymentMethod,
  SubscriptionStatus,
  SubscriptionType,
} from "@prisma/client";
import { Decimal } from "@prisma/client/runtime/library";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { audit } from "@/lib/audit";
import { evaluateDunning, runDunningBatch } from "@/lib/billing/dunning";
import { calculateGst } from "@/lib/billing/gst";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/rbac";

export type ActionResult =
  | { ok: true; id?: string; message?: string }
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

function fyLabel(d = new Date()): string {
  const y = d.getUTCFullYear();
  const m = d.getUTCMonth();
  const start = m >= 3 ? y : y - 1;
  return `${String(start).slice(2)}${String(start + 1).slice(2)}`;
}

async function nextPayNumber(siteCode: string) {
  const stub = `LIF/${siteCode}/PAY/${fyLabel()}/`;
  const latest = await prisma.payment.findFirst({
    where: { paymentNumber: { startsWith: stub } },
    orderBy: { paymentNumber: "desc" },
  });
  const seq = latest
    ? Number(latest.paymentNumber.slice(stub.length)) + 1
    : 1;
  return `${stub}${String(seq).padStart(5, "0")}`;
}

async function nextCnNumber(siteCode: string) {
  const stub = `LIF/${siteCode}/CN/${fyLabel()}/`;
  const latest = await prisma.creditNote.findFirst({
    where: { creditNoteNumber: { startsWith: stub } },
    orderBy: { creditNoteNumber: "desc" },
  });
  const seq = latest
    ? Number(latest.creditNoteNumber.slice(stub.length)) + 1
    : 1;
  return `${stub}${String(seq).padStart(5, "0")}`;
}

async function nextSubNumber() {
  const stub = `SUB-${new Date().toISOString().slice(0, 7).replace("-", "")}-`;
  const latest = await prisma.subscription.findFirst({
    where: { subscriptionNumber: { startsWith: stub } },
    orderBy: { subscriptionNumber: "desc" },
  });
  const seq = latest
    ? Number(latest.subscriptionNumber.slice(stub.length)) + 1
    : 1;
  return `${stub}${String(seq).padStart(4, "0")}`;
}

async function invoiceBalance(invoiceId: string): Promise<Decimal> {
  const inv = await prisma.invoice.findUniqueOrThrow({
    where: { id: invoiceId },
    include: { payments: true, creditNotes: true },
  });
  const paid = inv.payments.reduce((s, p) => s.add(p.amount), new Decimal(0));
  const credited = inv.creditNotes.reduce(
    (s, c) => s.add(c.amount),
    new Decimal(0),
  );
  return new Decimal(inv.netPayable).sub(paid).sub(credited);
}

const paymentSchema = z.object({
  invoiceId: z.string().min(1),
  method: z.nativeEnum(PaymentMethod),
  amount: z.number().positive(),
  referenceNumber: z.string().optional(),
  paidAt: z.string().min(1),
  notes: z.string().optional(),
});

export async function recordManualPayment(
  input: z.infer<typeof paymentSchema>,
): Promise<ActionResult> {
  try {
    const session = await requirePermission("invoice.record_payment");
    const parsed = paymentSchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: "Validation failed" };
    const d = parsed.data;

    const invoice = await prisma.invoice.findUniqueOrThrow({
      where: { id: d.invoiceId },
      include: { site: true },
    });
    if (invoice.status === InvoiceStatus.VOID) {
      return { ok: false, error: "Cannot pay a void invoice" };
    }

    const balance = await invoiceBalance(d.invoiceId);
    if (new Decimal(d.amount).gt(balance.add(0.01))) {
      return { ok: false, error: "Amount exceeds outstanding balance" };
    }

    const paymentNumber = await nextPayNumber(invoice.site.code);
    const payment = await prisma.payment.create({
      data: {
        paymentNumber,
        invoiceId: invoice.id,
        amount: new Decimal(d.amount),
        method: d.method,
        referenceNumber: d.referenceNumber || null,
        notes: d.notes || null,
        bankRef: d.referenceNumber || null,
        paidAt: new Date(d.paidAt),
      },
    });

    const remaining = balance.sub(d.amount);
    const status =
      remaining.lte(0.01) ? InvoiceStatus.PAID_FULL : InvoiceStatus.PAID_PARTIAL;

    await prisma.invoice.update({
      where: { id: invoice.id },
      data: {
        status,
        paidAt: status === InvoiceStatus.PAID_FULL ? new Date() : null,
        dunningStage:
          status === InvoiceStatus.PAID_FULL ? "NONE" : invoice.dunningStage,
      },
    });

    await audit.log({
      actorUserId: session.userId,
      action: "CREATE",
      entityType: "Payment",
      entityId: payment.id,
      afterJson: {
        invoiceId: invoice.id,
        amount: d.amount,
        method: d.method,
      },
    });

    revalidatePath(`/admin/invoices/${invoice.id}`);
    revalidatePath("/admin/invoices");
    revalidatePath("/admin/payments");
    return { ok: true, id: payment.id };
  } catch (err) {
    return catchPerm(err);
  }
}

const creditSchema = z.object({
  invoiceId: z.string().min(1),
  reasonCode: z.enum(["RETURN", "ADJUSTMENT", "REFUND", "WRITE_OFF"]),
  amount: z.number().positive(),
  reasonNote: z.string().optional(),
});

export async function issueCreditNote(
  input: z.infer<typeof creditSchema>,
): Promise<ActionResult> {
  try {
    const session = await requirePermission("invoice.credit_note");
    const parsed = creditSchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: "Validation failed" };
    const d = parsed.data;

    const invoice = await prisma.invoice.findUniqueOrThrow({
      where: { id: d.invoiceId },
      include: { site: true, payments: true, creditNotes: true },
    });

    const paid = invoice.payments.reduce(
      (s, p) => s.add(p.amount),
      new Decimal(0),
    );
    const alreadyCredited = invoice.creditNotes.reduce(
      (s, c) => s.add(c.amount),
      new Decimal(0),
    );
    const maxCredit = Decimal.max(paid.sub(alreadyCredited), new Decimal(0));
    // Allow credit up to paid amount (refund path) or outstanding for adjustment
    const outstanding = await invoiceBalance(d.invoiceId);
    const cap = Decimal.max(maxCredit, outstanding);

    if (new Decimal(d.amount).gt(cap.add(0.01))) {
      return {
        ok: false,
        error: `Credit amount must be ≤ ₹${cap.toFixed(2)}`,
      };
    }

    const creditNoteNumber = await nextCnNumber(invoice.site.code);
    const cn = await prisma.creditNote.create({
      data: {
        creditNoteNumber,
        invoiceId: invoice.id,
        amount: new Decimal(d.amount),
        reasonCode: d.reasonCode,
        reasonNote: d.reasonNote || null,
        approvedBy: session.userId,
      },
    });

    const newBalance = outstanding.sub(d.amount);
    await prisma.invoice.update({
      where: { id: invoice.id },
      data: {
        status:
          newBalance.lte(0.01) && paid.gt(0)
            ? InvoiceStatus.CREDITED
            : newBalance.lte(0.01)
              ? InvoiceStatus.PAID_FULL
              : invoice.status,
      },
    });

    await audit.log({
      actorUserId: session.userId,
      action: "CREATE",
      entityType: "CreditNote",
      entityId: cn.id,
      afterJson: {
        invoiceId: invoice.id,
        amount: d.amount,
        reasonCode: d.reasonCode,
      },
    });

    await prisma.eventEmission.create({
      data: {
        eventName: "credit_note.raised",
        payload: {
          creditNoteId: cn.id,
          invoiceId: invoice.id,
        },
        targetSystem: "ZOHO_BOOKS",
        consumerStatus: "PENDING",
      },
    });

    revalidatePath(`/admin/invoices/${invoice.id}`);
    return { ok: true, id: cn.id };
  } catch (err) {
    return catchPerm(err);
  }
}

export async function voidInvoice(invoiceId: string): Promise<ActionResult> {
  try {
    const session = await requirePermission("invoice.void");
    const invoice = await prisma.invoice.findUniqueOrThrow({
      where: { id: invoiceId },
      include: { payments: true },
    });
    if (invoice.payments.length > 0) {
      return { ok: false, error: "Cannot void invoice with payments — use credit note" };
    }
    await prisma.invoice.update({
      where: { id: invoiceId },
      data: { status: InvoiceStatus.VOID },
    });
    await audit.log({
      actorUserId: session.userId,
      action: "UPDATE",
      entityType: "Invoice",
      entityId: invoiceId,
      afterJson: { status: "VOID" },
    });
    revalidatePath(`/admin/invoices/${invoiceId}`);
    return { ok: true };
  } catch (err) {
    return catchPerm(err);
  }
}

export async function sendInvoiceReminder(
  invoiceId: string,
): Promise<ActionResult> {
  try {
    const session = await requirePermission("invoice.dunning");
    const result = await evaluateDunning(invoiceId, session.userId);
    revalidatePath(`/admin/invoices/${invoiceId}`);
    return {
      ok: true,
      message: result.emailDraft?.subject ?? "Reminder logged",
    };
  } catch (err) {
    return catchPerm(err);
  }
}

export async function runBulkDunning(): Promise<ActionResult> {
  try {
    const session = await requirePermission("invoice.dunning");
    const r = await runDunningBatch(session.userId);
    revalidatePath("/admin/invoices");
    return {
      ok: true,
      message: `Evaluated ${r.evaluated}, advanced ${r.advanced}`,
    };
  } catch (err) {
    return catchPerm(err);
  }
}

const subSchema = z.object({
  subscriberType: z.enum(["CLINIC", "RECIPIENT"]),
  subscriberId: z.string().min(1),
  siteId: z.string().min(1),
  type: z.nativeEnum(SubscriptionType),
  frequency: z.nativeEnum(BillingFrequency),
  startedAt: z.string().min(1),
  unitAmount: z.number().positive(),
  quantity: z.number().int().min(1),
  notes: z.string().optional(),
});

export async function createSubscription(
  input: z.infer<typeof subSchema>,
): Promise<ActionResult> {
  try {
    const session = await requirePermission("subscription.create");
    const parsed = subSchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: "Validation failed" };
    const d = parsed.data;

    const skuCode =
      d.type === SubscriptionType.STORAGE_MONTHLY ||
      d.type === SubscriptionType.STORAGE_ANNUAL
        ? "SKU-STOR-SEM"
        : d.type === SubscriptionType.MEMBERSHIP_PREMIUM
          ? "SKU-ENG-SUB"
          : "SKU-MEM-CLIN";

    let gstAmount = new Decimal(0);
    let totalAmount = new Decimal(d.unitAmount).mul(d.quantity);

    if (d.subscriberType === "CLINIC") {
      const gst = await calculateGst(
        totalAmount,
        d.siteId,
        d.subscriberId,
        18,
      );
      gstAmount = gst.totalGst;
      totalAmount = gst.total;
    } else {
      gstAmount = totalAmount.mul(18).div(100);
      totalAmount = totalAmount.add(gstAmount);
    }

    const started = new Date(d.startedAt);
    const next = new Date(started);
    if (d.frequency === BillingFrequency.MONTHLY) {
      next.setUTCMonth(next.getUTCMonth() + 1);
    } else if (d.frequency === BillingFrequency.QUARTERLY) {
      next.setUTCMonth(next.getUTCMonth() + 3);
    } else {
      next.setUTCFullYear(next.getUTCFullYear() + 1);
    }

    const subscriptionNumber = await nextSubNumber();
    const sub = await prisma.subscription.create({
      data: {
        subscriptionNumber,
        type: d.type,
        frequency: d.frequency,
        skuCode,
        subscriberType: d.subscriberType,
        subscriberId: d.subscriberId,
        status: SubscriptionStatus.ACTIVE,
        startedAt: started,
        nextBillingAt: next,
        quantity: d.quantity,
        unitAmount: new Decimal(d.unitAmount),
        gstAmount,
        totalAmount,
        siteId: d.siteId,
        notes: d.notes || null,
      },
    });

    await audit.log({
      actorUserId: session.userId,
      action: "CREATE",
      entityType: "Subscription",
      entityId: sub.id,
      afterJson: {
        subscriptionNumber,
        type: d.type,
        totalAmount: totalAmount.toString(),
      },
    });

    await prisma.eventEmission.create({
      data: {
        eventName: "subscription.created",
        payload: { subscriptionId: sub.id },
        targetSystem: "ZOHO_BOOKS",
        consumerStatus: "PENDING",
      },
    });

    revalidatePath("/admin/subscriptions");
    return { ok: true, id: sub.id };
  } catch (err) {
    return catchPerm(err);
  }
}

export async function pauseSubscription(id: string): Promise<ActionResult> {
  try {
    const session = await requirePermission("subscription.modify");
    await prisma.subscription.update({
      where: { id },
      data: { status: SubscriptionStatus.PAUSED },
    });
    await audit.log({
      actorUserId: session.userId,
      action: "UPDATE",
      entityType: "Subscription",
      entityId: id,
      afterJson: { status: "PAUSED" },
    });
    revalidatePath(`/admin/subscriptions/${id}`);
    return { ok: true };
  } catch (err) {
    return catchPerm(err);
  }
}

export async function cancelSubscription(id: string): Promise<ActionResult> {
  try {
    const session = await requirePermission("subscription.cancel");
    await prisma.subscription.update({
      where: { id },
      data: {
        status: SubscriptionStatus.CANCELLED,
        endedAt: new Date(),
      },
    });
    await audit.log({
      actorUserId: session.userId,
      action: "UPDATE",
      entityType: "Subscription",
      entityId: id,
      afterJson: { status: "CANCELLED" },
    });
    revalidatePath(`/admin/subscriptions/${id}`);
    return { ok: true };
  } catch (err) {
    return catchPerm(err);
  }
}

export async function changeSubscriptionPlan(input: {
  id: string;
  type: SubscriptionType;
  unitAmount: number;
  frequency: BillingFrequency;
}): Promise<ActionResult> {
  try {
    const session = await requirePermission("subscription.modify");
    await prisma.subscription.update({
      where: { id: input.id },
      data: {
        type: input.type,
        frequency: input.frequency,
        unitAmount: new Decimal(input.unitAmount),
        totalAmount: new Decimal(input.unitAmount),
        gstAmount: new Decimal(input.unitAmount).mul(18).div(100),
      },
    });
    await audit.log({
      actorUserId: session.userId,
      action: "UPDATE",
      entityType: "Subscription",
      entityId: input.id,
      afterJson: input,
    });
    revalidatePath(`/admin/subscriptions/${input.id}`);
    return { ok: true };
  } catch (err) {
    return catchPerm(err);
  }
}
