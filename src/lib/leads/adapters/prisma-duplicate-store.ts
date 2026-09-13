import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/db";
import { normalizeEmailExact, normalizePhoneDigits, type LeadMatchContact } from "../domain/duplicate/match-rules";

export type DuplicateLeadSide = {
  id: string;
  leadCode: string;
  fullName: string | null;
  phone: string | null;
  email: string | null;
  status: string;
  outcome: string | null;
  personType: string;
  source: string;
  capturedAt: Date;
  convertedDonorId: string | null;
  convertedRecipientId: string | null;
  city: string | null;
  state: string | null;
};

export type DuplicateCandidateRow = {
  id: string;
  fullName: string | null;
  phone: string | null;
  email: string | null;
};

const SIDE_SELECT = {
  id: true,
  leadCode: true,
  fullName: true,
  phone: true,
  email: true,
  status: true,
  outcome: true,
  personType: true,
  source: true,
  capturedAt: true,
  convertedDonorId: true,
  convertedRecipientId: true,
  city: true,
  state: true,
} as const;

export async function findDuplicateCandidates(
  incoming: LeadMatchContact,
): Promise<DuplicateCandidateRow[]> {
  const digits = normalizePhoneDigits(incoming.phone);
  const email = normalizeEmailExact(incoming.email);
  const or: Prisma.LeadWhereInput[] = [];
  if (incoming.phone) or.push({ phone: incoming.phone });
  if (email) {
    or.push({ email: { equals: email, mode: "insensitive" } });
    if (incoming.email && incoming.email !== email) {
      or.push({ email: incoming.email });
    }
  }
  const exactHits = or.length
    ? await prisma.lead.findMany({
        where: {
          id: { not: incoming.id },
          mergedIntoLeadId: null,
          isArchived: false,
          OR: or,
        },
        select: { id: true, fullName: true, phone: true, email: true },
        take: 200,
      })
    : [];

  const extra: DuplicateCandidateRow[] = [];
  if (digits) {
    extra.push(
      ...(await prisma.$queryRaw<DuplicateCandidateRow[]>`
        SELECT id, "fullName", phone, email
        FROM "Lead"
        WHERE id <> ${incoming.id}
          AND "mergedIntoLeadId" IS NULL
          AND "isArchived" = false
          AND regexp_replace(coalesce(phone, ''), '[^0-9]', '', 'g') = ${digits}
        LIMIT 200
      `),
    );
  }

  const byId = new Map<string, DuplicateCandidateRow>();
  for (const row of [...exactHits, ...extra]) byId.set(row.id, row);
  return [...byId.values()];
}

export async function loadDuplicateLeadSide(id: string): Promise<DuplicateLeadSide | null> {
  return prisma.lead.findUnique({
    where: { id },
    select: SIDE_SELECT,
  });
}
