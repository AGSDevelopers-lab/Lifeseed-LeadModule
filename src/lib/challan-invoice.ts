import { Decimal } from "@prisma/client/runtime/library";
import {
  ChallanStatus,
  InvoiceStatus,
  type Challan,
  type Prisma,
} from "@prisma/client";

import { audit } from "@/lib/audit";
import { prisma } from "@/lib/db";

function fyLabel(d = new Date()): string {
  const y = d.getUTCFullYear();
  const m = d.getUTCMonth(); // 0-based
  // Indian FY Apr–Mar
  const start = m >= 3 ? y : y - 1;
  return `${String(start).slice(2)}${String(start + 1).slice(2)}`;
}

async function nextDocNumber(
  kind: "CHL" | "INV",
  siteCode: string,
): Promise<string> {
  const fy = fyLabel();
  const stub = `LIF/${siteCode}/${kind}/${fy}/`;
  if (kind === "CHL") {
    const latest = await prisma.challan.findFirst({
      where: { challanNumber: { startsWith: stub } },
      orderBy: { challanNumber: "desc" },
      select: { challanNumber: true },
    });
    const seq = latest
      ? Number(latest.challanNumber.slice(stub.length)) + 1
      : 1;
    return `${stub}${String(seq).padStart(5, "0")}`;
  }
  const latest = await prisma.invoice.findFirst({
    where: { invoiceNumber: { startsWith: stub } },
    orderBy: { invoiceNumber: "desc" },
    select: { invoiceNumber: true },
  });
  const seq = latest
    ? Number(latest.invoiceNumber.slice(stub.length)) + 1
    : 1;
  return `${stub}${String(seq).padStart(5, "0")}`;
}

function money(n: number | string | Decimal): Decimal {
  return new Decimal(n);
}

/**
 * Raise Delivery Challan for a DRF (challan-first).
 * GSTIN taken from the DRF target site (multi-GSTIN aware).
 */
export async function raiseChallan(
  drfId: string,
  actorUserId: string,
): Promise<Challan> {
  const drf = await prisma.dRF.findUniqueOrThrow({
    where: { id: drfId },
    include: {
      site: true,
      clinic: true,
      dispatches: { orderBy: { createdAt: "desc" }, take: 1 },
    },
  });

  const gstin = drf.site.gstin;
  if (!gstin) {
    throw new Error(
      `Site ${drf.site.code} has no GSTIN — cannot raise challan`,
    );
  }

  const vialCount = Array.isArray(drf.assignedVialIds)
    ? (drf.assignedVialIds as string[]).length
    : drf.requestedQuantity;

  const sku =
    (await prisma.sKU.findUnique({ where: { code: "SKU-SEM-VIAL" } })) ??
    (await prisma.sKU.findFirst({ where: { isActive: true } }));
  if (!sku) throw new Error("No SKU configured for challan line items");

  const qty = money(Math.max(1, vialCount));
  const unitPrice = money(sku.defaultPrice);
  const gstRate = money(sku.gstRatePct);
  const taxable = qty.mul(unitPrice);
  const gst = taxable.mul(gstRate).div(100);
  // Inter-state vs intra: simplify — if clinic.state != site, IGST else CGST+SGST
  const interState = drf.clinic.stateCode !== String(drf.site.code);
  const igst = interState ? gst : money(0);
  const half = interState ? money(0) : gst.div(2);
  const lineTotal = taxable.add(gst);

  const challanNumber = await nextDocNumber("CHL", drf.site.code);
  const dispatchId = drf.dispatches[0]?.id ?? null;

  const challan = await prisma.challan.create({
    data: {
      challanNumber,
      siteId: drf.siteId,
      dispatchId,
      drfId: drf.id,
      gstin,
      buyerType: "CLINIC",
      buyerId: drf.clinicId,
      totalValue: taxable,
      taxableValue: taxable,
      totalGst: gst,
      totalWithGst: lineTotal,
      status: ChallanStatus.RAISED,
      lineItems: {
        create: [
          {
            skuCode: sku.code,
            description: sku.description,
            quantity: qty,
            unitPrice,
            discount: money(0),
            taxableValue: taxable,
            gstRatePct: gstRate,
            igst,
            cgst: half,
            sgst: half,
            lineTotal,
          },
        ],
      },
    },
  });

  await audit.log({
    actorUserId,
    action: "CREATE",
    entityType: "Challan",
    entityId: challan.id,
    afterJson: {
      challanNumber,
      drfId,
      status: ChallanStatus.RAISED,
    },
  });

  await prisma.eventEmission.create({
    data: {
      eventName: "challan.raised",
      payload: {
        challanId: challan.id,
        drfId,
        challanNumber,
      } as Prisma.InputJsonValue,
      targetSystem: "ZOHO_BOOKS",
      consumerStatus: "PENDING",
    },
  });

  return challan;
}

/**
 * Auto-convert Challan → Tax Invoice (fires on DRF Delivered).
 */
export async function convertChallanToInvoice(
  challanId: string,
  actorUserId: string,
) {
  const challan = await prisma.challan.findUniqueOrThrow({
    where: { id: challanId },
    include: {
      lineItems: true,
      site: true,
      drf: { include: { clinic: { include: { contract: true } } } },
    },
  });

  if (challan.status === ChallanStatus.CONVERTED_TO_INVOICE) {
    return prisma.invoice.findUniqueOrThrow({
      where: { parentChallanId: challan.id },
    });
  }
  if (challan.status === ChallanStatus.CANCELLED) {
    throw new Error("Cannot convert a cancelled challan");
  }

  const terms =
    challan.drf?.clinic.contract?.paymentTerms ?? "NET_30";
  const netDays = Number(terms.replace(/\D/g, "")) || 30;
  const dueDate = new Date();
  dueDate.setUTCDate(dueDate.getUTCDate() + netDays);

  const invoiceNumber = await nextDocNumber("INV", challan.site.code);

  const invoice = await prisma.invoice.create({
    data: {
      invoiceNumber,
      siteId: challan.siteId,
      parentChallanId: challan.id,
      drfId: challan.drfId,
      dispatchId: challan.dispatchId,
      gstin: challan.gstin,
      buyerType: challan.buyerType,
      buyerId: challan.buyerId,
      placeOfSupplyStateCode:
        challan.drf?.clinic.stateCode ?? challan.site.code,
      totalValue: challan.totalValue,
      taxableValue: challan.taxableValue,
      totalGst: challan.totalGst,
      totalWithGst: challan.totalWithGst,
      netPayable: challan.totalWithGst,
      paymentTerms: terms,
      dueDate,
      status: InvoiceStatus.RAISED,
      lineItems: {
        create: challan.lineItems.map((li) => ({
          skuCode: li.skuCode,
          description: li.description,
          quantity: li.quantity,
          unitPrice: li.unitPrice,
          discount: li.discount,
          taxableValue: li.taxableValue,
          gstRatePct: li.gstRatePct,
          igst: li.igst,
          cgst: li.cgst,
          sgst: li.sgst,
          lineTotal: li.lineTotal,
        })),
      },
    },
  });

  await prisma.challan.update({
    where: { id: challan.id },
    data: {
      status: ChallanStatus.CONVERTED_TO_INVOICE,
      convertedToInvoiceAt: new Date(),
    },
  });

  await audit.log({
    actorUserId,
    action: "UPDATE",
    entityType: "Challan",
    entityId: challan.id,
    afterJson: {
      status: ChallanStatus.CONVERTED_TO_INVOICE,
      invoiceId: invoice.id,
      invoiceNumber,
    },
  });

  await prisma.eventEmission.create({
    data: {
      eventName: "invoice.raised",
      payload: {
        invoiceId: invoice.id,
        challanId: challan.id,
        drfId: challan.drfId,
        invoiceNumber,
      } as Prisma.InputJsonValue,
      targetSystem: "ZOHO_BOOKS",
      consumerStatus: "PENDING",
    },
  });

  return invoice;
}
