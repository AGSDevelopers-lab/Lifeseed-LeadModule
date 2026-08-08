import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { PaymentMethod, type Prisma } from "@prisma/client";

import {
  handleGatewaySuccess,
  verifyGatewayCallback,
} from "@/lib/billing/gateway";
import { prisma } from "@/lib/db";

export async function POST(req: NextRequest) {
  const signature =
    req.headers.get("x-razorpay-signature") ??
    req.headers.get("X-Razorpay-Signature") ??
    "";
  const raw = await req.text();

  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const valid = verifyGatewayCallback("RAZORPAY", raw, signature);

  const event = String(payload.event ?? "");
  const entity =
    ((payload.payload as Record<string, unknown> | undefined)
      ?.payment as Record<string, unknown> | undefined)?.entity ??
    (payload.payload as Record<string, unknown> | undefined)?.payment ??
    payload;

  const paymentEntity = entity as Record<string, unknown>;
  const gatewayPaymentId = String(
    paymentEntity.id ?? payload.gatewayPaymentId ?? "",
  );
  const notes = (paymentEntity.notes ?? {}) as Record<string, unknown>;
  const invoiceId = String(
    notes.invoiceId ?? payload.invoiceId ?? paymentEntity.invoice_id ?? "",
  );

  await prisma.paymentGatewayLog.create({
    data: {
      gateway: "RAZORPAY",
      eventType: event || "unknown",
      gatewayPaymentId: gatewayPaymentId || null,
      gatewayOrderId: paymentEntity.order_id
        ? String(paymentEntity.order_id)
        : null,
      invoiceId: invoiceId || null,
      payload: payload as Prisma.InputJsonValue,
      signatureValid: valid,
      processed: false,
    },
  });

  if (!valid) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  if (event === "payment.captured" || payload.status === "captured") {
    if (!invoiceId || !gatewayPaymentId) {
      return NextResponse.json(
        { error: "Missing invoiceId or payment id" },
        { status: 400 },
      );
    }

    const amountPaise = Number(paymentEntity.amount ?? 0);
    const result = await handleGatewaySuccess({
      invoiceId,
      gatewayPaymentId,
      method: PaymentMethod.RAZORPAY,
      amount: amountPaise > 0 ? amountPaise / 100 : undefined,
      gateway: "RAZORPAY",
    });

    await prisma.paymentGatewayLog.updateMany({
      where: { gatewayPaymentId, gateway: "RAZORPAY" },
      data: { processed: true },
    });

    return NextResponse.json({ ok: true, ...result });
  }

  return NextResponse.json({ ok: true, ignored: true });
}
