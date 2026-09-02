/** Browser-only PII helpers — never import Node crypto here. */

import { z } from "zod";

export async function sha256HexBrowser(value: string): Promise<string> {
  const data = new TextEncoder().encode(value.trim());
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** Raw Aadhaar input → digits only. Empty or exactly 12 digits. */
export const aadhaarOptionalSchema = z
  .string()
  .transform((val) => val.trim().replace(/\D/g, ""))
  .refine((val) => val.length === 0 || val.length === 12, {
    message: "Aadhaar must be exactly 12 digits (or empty)",
  })
  .refine((val) => val.length === 0 || /^\d{12}$/.test(val), {
    message: "Aadhaar must contain only digits",
  });

/** Required 12-digit Aadhaar (intake). */
export const aadhaarRequiredSchema = z
  .string()
  .transform((val) => val.trim().replace(/\D/g, ""))
  .refine((val) => val.length === 12, {
    message: "Aadhaar must be exactly 12 digits",
  })
  .refine((val) => /^\d{12}$/.test(val), {
    message: "Aadhaar must contain only digits",
  });

export function maskPanClient(pan: string): string {
  const cleaned = pan.replace(/\s+/g, "").toUpperCase();
  if (cleaned.length < 4) return "XXXX";
  return `${"X".repeat(Math.max(0, cleaned.length - 4))}${cleaned.slice(-4)}`;
}

export function computeBmi(heightCm: number, weightKg: number): number {
  const m = heightCm / 100;
  if (m <= 0) return 0;
  return Math.round((weightKg / (m * m)) * 10) / 10;
}
