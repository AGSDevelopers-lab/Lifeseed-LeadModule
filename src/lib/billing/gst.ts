import { Decimal } from "@prisma/client/runtime/library";

import { prisma } from "@/lib/db";

/** GSTIN first 2 digits → Indian state code. WB=19, TG=36. */
export const SITE_STATE_GST: Record<string, string> = {
  WB: "19",
  TG: "36",
  BD: "19", // fallback until BD GSTIN live
};

export type GstBreakdown = {
  taxable: Decimal;
  gstRatePct: Decimal;
  igst: Decimal;
  cgst: Decimal;
  sgst: Decimal;
  totalGst: Decimal;
  total: Decimal;
  interState: boolean;
  sellerGstin: string;
  sellerStateCode: string;
  buyerStateCode: string;
};

function d(n: number | string | Decimal): Decimal {
  return n instanceof Decimal ? n : new Decimal(n);
}

/**
 * Place-of-supply GST split.
 * Intra-state (same state code) → CGST + SGST; inter-state → IGST.
 * Seller GSTIN taken from origin Site.
 */
export async function calculateGst(
  subtotal: number | string | Decimal,
  fromSiteId: string,
  toClinicId: string,
  gstRatePct: number | string | Decimal = 18,
): Promise<GstBreakdown> {
  const [site, clinic] = await Promise.all([
    prisma.site.findUniqueOrThrow({ where: { id: fromSiteId } }),
    prisma.clinic.findUniqueOrThrow({ where: { id: toClinicId } }),
  ]);

  if (!site.gstin) {
    throw new Error(`Site ${site.code} has no GSTIN configured`);
  }

  const sellerState =
    site.gstin.slice(0, 2) || SITE_STATE_GST[site.code] || "19";
  const buyerState =
    clinic.stateCode.length === 2 && /^\d+$/.test(clinic.stateCode)
      ? clinic.stateCode
      : SITE_STATE_GST[clinic.stateCode] ??
        SITE_STATE_GST[site.code] ??
        sellerState;

  // Clinic.stateCode may be "WB"/"TG" or numeric
  const buyerNorm =
    SITE_STATE_GST[clinic.stateCode] ??
    (clinic.stateCode.match(/^\d{2}$/) ? clinic.stateCode : buyerState);

  const taxable = d(subtotal);
  const rate = d(gstRatePct);
  const totalGst = taxable.mul(rate).div(100);
  const interState = sellerState !== buyerNorm;

  const igst = interState ? totalGst : d(0);
  const half = interState ? d(0) : totalGst.div(2);

  return {
    taxable,
    gstRatePct: rate,
    igst,
    cgst: half,
    sgst: half,
    totalGst,
    total: taxable.add(totalGst),
    interState,
    sellerGstin: site.gstin,
    sellerStateCode: sellerState,
    buyerStateCode: buyerNorm,
  };
}

/** Pure helper when state codes are already known (numeric). */
export function splitGstByStates(
  subtotal: number | string | Decimal,
  sellerStateCode: string,
  buyerStateCode: string,
  gstRatePct: number | string | Decimal = 18,
): Omit<
  GstBreakdown,
  "sellerGstin" | "sellerStateCode" | "buyerStateCode"
> & { interState: boolean } {
  const taxable = d(subtotal);
  const totalGst = taxable.mul(d(gstRatePct)).div(100);
  const interState = sellerStateCode !== buyerStateCode;
  const igst = interState ? totalGst : d(0);
  const half = interState ? d(0) : totalGst.div(2);
  return {
    taxable,
    gstRatePct: d(gstRatePct),
    igst,
    cgst: half,
    sgst: half,
    totalGst,
    total: taxable.add(totalGst),
    interState,
  };
}
