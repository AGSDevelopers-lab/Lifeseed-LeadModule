import { LeadCode } from "../domain/value-objects/LeadCode";
import {
  cityToCode,
  generateLeadCode as generateLegacyLeadCode,
  leadCodePrefix,
} from "../lead-code-generator";

export type LeadCodeQueryClient = {
  $queryRaw: (
    query: TemplateStringsArray,
    ...values: unknown[]
  ) => Promise<unknown>;
};

export type LeadCodeCountClient = LeadCodeQueryClient & {
  lead: {
    count: (args: { where: { leadCode: { startsWith: string } } }) => Promise<number>;
  };
};

/** `LEAD_CODE_V2_ENABLED` — only the exact value `on` enables the Postgres generator. */
export function isLeadCodeV2Enabled(env?: {
  LEAD_CODE_V2_ENABLED?: string;
}): boolean {
  const flag = env?.LEAD_CODE_V2_ENABLED ?? process.env.LEAD_CODE_V2_ENABLED;
  return flag === "on";
}

function utcDayIso(day: Date): string {
  return day.toISOString().slice(0, 10);
}

function readNextCode(rows: unknown): string {
  if (!Array.isArray(rows) || rows.length === 0) {
    throw new Error("next_lead_code returned no rows");
  }
  const row = rows[0];
  if (typeof row !== "object" || row === null) {
    throw new Error("next_lead_code returned an unexpected row");
  }
  const record = row as Record<string, unknown>;
  const raw = record.code ?? record.next_lead_code;
  if (typeof raw !== "string") {
    throw new Error("next_lead_code returned a non-text value");
  }
  return LeadCode.parse(raw).toString();
}

/**
 * Allocates the next `LED-{CITY}-{YYYYMMDD}-{XXXX}` via `next_lead_code`.
 * Always hits Postgres — feature-flag routing lives in `allocateLeadCode` / create-lead.
 */
export async function generateLeadCode(
  prisma: LeadCodeQueryClient,
  cityCode: string,
  day: Date = new Date(),
): Promise<string> {
  const normalized = cityCode.trim().toUpperCase();
  const dayIso = utcDayIso(day);
  const rows = await prisma.$queryRaw`
    SELECT next_lead_code(${normalized}::text, ${dayIso}::date)::text AS code
  `;
  return readNextCode(rows);
}

/**
 * Flag-aware allocator used by intake. Legacy path is the existing count+1 generator.
 */
export async function allocateLeadCode(
  prisma: LeadCodeCountClient,
  city: string | null | undefined,
  capturedAt: Date = new Date(),
): Promise<string> {
  if (!isLeadCodeV2Enabled()) {
    const prefix = leadCodePrefix(city, capturedAt);
    const count = await prisma.lead.count({
      where: { leadCode: { startsWith: prefix } },
    });
    return generateLegacyLeadCode(city, capturedAt, count + 1);
  }
  return generateLeadCode(prisma, cityToCode(city), capturedAt);
}
