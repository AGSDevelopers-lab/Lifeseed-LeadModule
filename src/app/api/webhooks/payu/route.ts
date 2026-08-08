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
    req.headers.get("x-payu-signature") ??
    req.headers.get("hash") ??
    "";

  // PayU often posts form-urlencoded
  const contentType = req.headers.get("content-type") ?? "";
  let payload: Record<string, unknown>;
  let raw: string;

  if (contentType.includes("application/json")) {
    raw = await req.text();
    try {
      payload = JSON.parse(raw) as Record<string, unknown>;
    } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }
  } else {
    const form = await req.formData();
    payload = Object.fromEntries(
      [...form.entries()].map(([k, v]) => [k, String(v)]),
    );
    raw = JSON.stringify(payload);
  }

  const valid = verifyGatewayCallback(
    "PAYU",
    raw,
    signature || String(payload.hash ?? "stub_ok_"),
  );

  const gatewayPaymentId = String(
    payload.mihpayid ?? payload.txnid ?? payload.gatewayPaymentId ?? "",
  );
  const invoiceId = String(
    payload.udf1 ?? payload.invoiceId ?? payload.productinfo ?? "",
  );
  const status = String(payload.status ?? "").toLowerCase();

  await prisma.paymentGatewayLog.create({
    data: {
      gateway: "PAYU",
      eventType: status || "callback",
      gatewayPaymentId: gatewayPaymentId || null,
      gatewayOrderId: payload.txnid ? String(payload.txnid) : null,
      invoiceId: invoiceId || null,
      payload: payload as Prisma.InputJsonValue,
      signatureValid: valid,
      processed: false,
    },
  });

  if (!valid) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  if (status === "success" || status === "captured") {
    if (!invoiceId || !gatewayPaymentId) {
      return NextResponse.json(
        { error: "Missing invoiceId or payment id" },
        { status: 400 },
      );
    }

    const amount = Number(payload.amount ?? 0);
    const result = await handleGatewaySuccess({
      invoiceId,
      gatewayPaymentId,
      method: PaymentMethod.PAYU,
      amount: amount > 0 ? amount : undefined,
      gateway: "PAYU",
    });

    await prisma.paymentGatewayLog.updateMany({
      where: { gatewayPaymentId, gateway: "PAYU" },
      data: { processed: true },
    });

    return NextResponse.json({ ok: true, ...result });
  }

  return NextResponse.json({ ok: true, ignored: true });
}
