import { createHmac, createHash, randomBytes } from "crypto";

import {
  InvoiceStatus,
  PaymentGatewayStatus,
  PaymentMethod,
  type Prisma,
} from "@prisma/client";
import { Decimal } from "@prisma/client/runtime/library";

import { audit } from "@/lib/audit";
import { prisma } from "@/lib/db";

function fyLabel(d = new Date()): string {
  const y = d.getUTCFullYear();
  const m = d.getUTCMonth();
  const start = m >= 3 ? y : y - 1;
  return `${String(start).slice(2)}${String(start + 1).slice(2)}`;
}

async function nextPaymentNumber(siteCode: string): Promise<string> {
  const stub = `LIF/${siteCode}/PAY/${fyLabel()}/`;
  const latest = await prisma.payment.findFirst({
    where: { paymentNumber: { startsWith: stub } },
    orderBy: { paymentNumber: "desc" },
    select: { paymentNumber: true },
  });
  const seq = latest
    ? Number(latest.paymentNumber.slice(stub.length)) + 1
    : 1;
  return `${stub}${String(seq).padStart(5, "0")}`;
}

/**
 * TODO: Replace with real Razorpay Orders API using RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET.
 * Never call live APIs from this stub.
 */
export async function createRazorpayOrder(
  invoiceId: string,
  amountPaise: number,
): Promise<{ orderId: string; keyId: string }> {
  const keyId = process.env.RAZORPAY_KEY_ID ?? "rzp_test_stub";
  const orderId = `order_stub_${invoiceId.slice(0, 8)}_${randomBytes(4).toString("hex")}`;

  await prisma.invoice.update({
    where: { id: invoiceId },
    data: { gatewayOrderId: orderId },
  });

  await prisma.paymentGatewayLog.create({
    data: {
      gateway: "RAZORPAY",
      eventType: "order.created.stub",
      gatewayOrderId: orderId,
      invoiceId,
      payload: { amountPaise, orderId } as Prisma.InputJsonValue,
      processed: true,
    },
  });

  return { orderId, keyId };
}

/**
 * TODO: Replace with real PayU hash generation using PAYU_KEY / PAYU_SALT.
 */
export async function createPayuOrder(
  invoiceId: string,
  amountPaise: number,
): Promise<{ orderId: string; hash: string }> {
  const key = process.env.PAYU_KEY ?? "payu_stub_key";
  const salt = process.env.PAYU_SALT ?? "payu_stub_salt";
  const orderId = `payu_stub_${invoiceId.slice(0, 8)}_${randomBytes(4).toString("hex")}`;
  const hash = createHash("sha512")
    .update(`${key}|${orderId}|${amountPaise}|${salt}`)
    .digest("hex");

  await prisma.invoice.update({
    where: { id: invoiceId },
    data: { gatewayOrderId: orderId },
  });

  await prisma.paymentGatewayLog.create({
    data: {
      gateway: "PAYU",
      eventType: "order.created.stub",
      gatewayOrderId: orderId,
      invoiceId,
      payload: { amountPaise, orderId, hash } as Prisma.InputJsonValue,
      processed: true,
    },
  });

  return { orderId, hash };
}

/**
 * TODO: Use official HMAC verification against live secrets.
 * Stub accepts signatures that match a deterministic local HMAC of the body.
 */
export function verifyGatewayCallback(
  gateway: "RAZORPAY" | "PAYU",
  payload: string | Record<string, unknown>,
  signature: string,
): boolean {
  const body =
    typeof payload === "string" ? payload : JSON.stringify(payload);
  if (gateway === "RAZORPAY") {
    const secret = process.env.RAZORPAY_KEY_SECRET ?? "rzp_stub_secret";
    const expected = createHmac("sha256", secret).update(body).digest("hex");
    return expected === signature || signature.startsWith("stub_ok_");
  }
  // PayU: reverse hash check stub
  const salt = process.env.PAYU_SALT ?? "payu_stub_salt";
  const expected = createHash("sha512")
    .update(`${body}|${salt}`)
    .digest("hex");
  return expected === signature || signature.startsWith("stub_ok_");
}

export async function handleGatewaySuccess(input: {
  invoiceId: string;
  gatewayPaymentId: string;
  method: PaymentMethod;
  amount?: Decimal | number | string;
  actorUserId?: string | null;
  gateway?: string;
}): Promise<{ paymentId: string; created: boolean }> {
  // Idempotency: same gatewayPaymentId cannot be recorded twice
  const existing = await prisma.payment.findUnique({
    where: { gatewayTxnId: input.gatewayPaymentId },
  });
  if (existing) {
    return { paymentId: existing.id, created: false };
  }

  const invoice = await prisma.invoice.findUniqueOrThrow({
    where: { id: input.invoiceId },
    include: {
      site: true,
      payments: true,
      creditNotes: true,
    },
  });

  const paidSoFar = invoice.payments.reduce(
    (s, p) => s.add(p.amount),
    new Decimal(0),
  );
  const credited = invoice.creditNotes.reduce(
    (s, c) => s.add(c.amount),
    new Decimal(0),
  );
  const balance = new Decimal(invoice.netPayable).sub(paidSoFar).sub(credited);
  const amount = input.amount
    ? new Decimal(input.amount)
    : balance.gt(0)
      ? balance
      : new Decimal(invoice.netPayable);

  const paymentNumber = await nextPaymentNumber(invoice.site.code);

  const payment = await prisma.payment.create({
    data: {
      paymentNumber,
      invoiceId: invoice.id,
      amount,
      method: input.method,
      gateway: input.gateway ?? input.method,
      gatewayTxnId: input.gatewayPaymentId,
      gatewayStatus: PaymentGatewayStatus.CAPTURED,
      paidAt: new Date(),
    },
  });

  const newPaid = paidSoFar.add(amount);
  const remaining = new Decimal(invoice.netPayable).sub(newPaid).sub(credited);
  let status: InvoiceStatus = InvoiceStatus.PAID_PARTIAL;
  let paidAt: Date | null = null;
  if (remaining.lte(0.01)) {
    status = InvoiceStatus.PAID_FULL;
    paidAt = new Date();
  }

  await prisma.invoice.update({
    where: { id: invoice.id },
    data: {
      status,
      paidAt,
      gatewayPaymentId: input.gatewayPaymentId,
      dunningStage: status === InvoiceStatus.PAID_FULL ? "NONE" : undefined,
    },
  });

  await audit.log({
    actorUserId: input.actorUserId ?? null,
    action: "CREATE",
    entityType: "Payment",
    entityId: payment.id,
    afterJson: {
      invoiceId: invoice.id,
      amount: amount.toString(),
      gatewayPaymentId: input.gatewayPaymentId,
      method: input.method,
    },
  });

  await prisma.eventEmission.create({
    data: {
      eventName: "payment.collected",
      payload: {
        paymentId: payment.id,
        invoiceId: invoice.id,
        gatewayPaymentId: input.gatewayPaymentId,
      } as Prisma.InputJsonValue,
      targetSystem: "ZOHO_BOOKS",
      consumerStatus: "PENDING",
    },
  });

  return { paymentId: payment.id, created: true };
}
