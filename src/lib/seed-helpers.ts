import { createHash, randomInt } from "crypto";

import { Prisma } from "@prisma/client";

/** SHA-256 hex digest — used for Aadhaar-at-rest hashing (never store raw). */
export function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

/**
 * Builds a Verhoeff-valid-looking 12-digit Aadhaar-format string, then hashes it.
 * Seed only — the plaintext is discarded immediately after hashing.
 */
export function hashSeedAadhaar(seedTag: string): string {
  // Deterministic per seedTag so re-runs stay idempotent on aadhaarHash uniqueness.
  const digits = createHash("sha256")
    .update(`aadhaar:${seedTag}`)
    .digest("hex")
    .replace(/\D/g, "")
    .padEnd(12, "0")
    .slice(0, 12);
  // First digit of Aadhaar cannot be 0 or 1 — force into 2–9 range.
  const formatted = `${Math.max(2, Number(digits[0]) % 10)}${digits.slice(1)}`;
  return sha256(formatted);
}

export function money(value: number | string): Prisma.Decimal {
  return new Prisma.Decimal(value);
}

export function utcDate(
  year: number,
  month: number,
  day: number,
  hour = 0,
  minute = 0,
): Date {
  return new Date(Date.UTC(year, month - 1, day, hour, minute, 0, 0));
}

export function dobYearsAgo(years: number, month = 6, day = 15): Date {
  const now = new Date();
  return utcDate(now.getUTCFullYear() - years, month, day);
}

/** Stable fake Indian mobile — unique per key, starts with 6–9. */
export function seedPhone(key: string): string {
  const n = createHash("sha256").update(`phone:${key}`).digest("hex");
  const body = (parseInt(n.slice(0, 9), 16) % 1_000_000_000)
    .toString()
    .padStart(9, "0");
  const first = String(6 + (parseInt(n.slice(9, 10), 16) % 4));
  return `${first}${body}`;
}

export function seedEmail(local: string, domain = "lifeseed.local"): string {
  return `${local}@${domain}`;
}

/** Masked PAN display form — last 4 visible. */
export function maskPan(seedTag: string): string {
  const suffix = createHash("sha256")
    .update(`pan:${seedTag}`)
    .digest("hex")
    .slice(0, 4)
    .toUpperCase();
  return `XXXXX${suffix}`;
}

export function bmiFrom(heightCm: number, weightKg: number): number {
  const m = heightCm / 100;
  return Math.round((weightKg / (m * m)) * 10) / 10;
}

/** Non-crypto helper kept for future random seed fixtures. */
export function pickIndex(maxExclusive: number): number {
  return randomInt(0, maxExclusive);
}
