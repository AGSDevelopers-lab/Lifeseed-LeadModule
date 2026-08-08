import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { InvoiceStatus } from "@prisma/client";

import { prisma } from "@/lib/db";
import {
  getSession,
  permissionGranted,
  permissionsForRoles,
} from "@/lib/rbac";

/**
 * Zoho Books–compatible invoice CSV export.
 * Columns aligned to Zoho Books invoice import template (subset).
 */
export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (
    !permissionGranted(permissionsForRoles(session.roles), "invoice.list")
  ) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  const status = searchParams.get("status") as InvoiceStatus | null;

  const invoices = await prisma.invoice.findMany({
    where: {
      ...(status ? { status } : {}),
      ...(from || to
        ? {
            issuedAt: {
              ...(from ? { gte: new Date(from) } : {}),
              ...(to ? { lte: new Date(`${to}T23:59:59Z`) } : {}),
            },
          }
        : {}),
    },
    include: { lineItems: true, site: true },
    orderBy: { issuedAt: "asc" },
    take: 2000,
  });

  const clinics = await prisma.clinic.findMany({
    where: {
      id: {
        in: invoices
          .filter((i) => i.buyerType === "CLINIC")
          .map((i) => i.buyerId),
      },
    },
  });
  const clinicMap = new Map(clinics.map((c) => [c.id, c]));

  const headers = [
    "Invoice Number",
    "Invoice Date",
    "Due Date",
    "Customer Name",
    "GST Identification Number (GSTIN)",
    "Place of Supply",
    "Item Name",
    "Item Desc",
    "Quantity",
    "Item Price",
    "Tax Name",
    "Tax Percentage",
    "CGST",
    "SGST",
    "IGST",
    "Item Total",
    "Currency Code",
  ];

  const lines: string[] = [headers.join(",")];

  for (const inv of invoices) {
    const customer =
      inv.buyerType === "CLINIC"
        ? (clinicMap.get(inv.buyerId)?.name ?? inv.buyerId)
        : inv.buyerId;
    for (const li of inv.lineItems) {
      const taxName = Number(li.igst) > 0 ? "IGST" : "GST";
      const row = [
        inv.invoiceNumber,
        inv.issuedAt.toISOString().slice(0, 10),
        inv.dueDate.toISOString().slice(0, 10),
        csv(customer),
        inv.gstin,
        inv.placeOfSupplyStateCode,
        csv(li.skuCode),
        csv(li.description),
        li.quantity.toString(),
        li.unitPrice.toString(),
        taxName,
        li.gstRatePct.toString(),
        li.cgst.toString(),
        li.sgst.toString(),
        li.igst.toString(),
        li.lineTotal.toString(),
        "INR",
      ];
      lines.push(row.join(","));
    }
  }

  const body = lines.join("\n");
  return new NextResponse(body, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="zoho-invoices-export.csv"`,
    },
  });
}

function csv(v: string) {
  if (v.includes(",") || v.includes('"') || v.includes("\n")) {
    return `"${v.replace(/"/g, '""')}"`;
  }
  return v;
}
