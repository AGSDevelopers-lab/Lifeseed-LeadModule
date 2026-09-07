import { DncChannel, DncSource } from "../domain/enums";
import type { DncChannel as DncChannelT, DncSource as DncSourceT } from "../domain/enums";
import { NotificationChannel } from "../domain/enums";
import type { NotificationChannel as NotificationChannelT } from "../domain/enums";
import { dncToDomain } from "../adapters/mappers/dnc-mapper";
import type { LeadDoNotCall } from "../domain/entities/LeadDoNotCall";

export type DncStore = {
  leadDoNotCall: {
    findMany: (args: object) => Promise<Array<Record<string, unknown>>>;
    findFirst: (args: object) => Promise<Record<string, unknown> | null>;
    findUnique: (args: object) => Promise<Record<string, unknown> | null>;
    create: (args: object) => Promise<Record<string, unknown>>;
    update: (args: object) => Promise<Record<string, unknown>>;
  };
  lead?: {
    updateMany: (args: object) => Promise<unknown>;
  };
};

async function resolveStore(store?: DncStore): Promise<DncStore> {
  if (store) return store;
  const { prisma } = await import("@/lib/db");
  return prisma as unknown as DncStore;
}

export function normaliseEmail(raw: string): string {
  return raw.trim().toLowerCase();
}

/** E.164; default country code +91 for 10-digit national numbers. */
export function normalisePhone(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return "";
  if (trimmed.startsWith("+")) {
    return `+${trimmed.slice(1).replace(/\D/g, "")}`;
  }
  const digits = trimmed.replace(/\D/g, "");
  if (digits.length === 10) return `+91${digits}`;
  if (digits.length === 12 && digits.startsWith("91")) return `+${digits}`;
  if (digits.length === 11 && digits.startsWith("0")) return `+91${digits.slice(1)}`;
  return digits ? `+${digits}` : "";
}

export function normaliseValue(channel: DncChannelT, raw: string): string {
  if (channel === DncChannel.EMAIL) return normaliseEmail(raw);
  if (
    channel === DncChannel.PHONE ||
    channel === DncChannel.SMS ||
    channel === DncChannel.WHATSAPP
  ) {
    return normalisePhone(raw);
  }
  const asEmail = raw.includes("@");
  return asEmail ? normaliseEmail(raw) : normalisePhone(raw) || raw.trim().toLowerCase();
}

export function lookupChannels(channel: DncChannelT): DncChannelT[] {
  const set = new Set<DncChannelT>([channel, DncChannel.ALL]);
  if (channel === DncChannel.SMS || channel === DncChannel.WHATSAPP) {
    set.add(DncChannel.PHONE);
  }
  return [...set];
}

export const lookupChannel = lookupChannels;

export function dncChannelForNotification(channel: NotificationChannelT): DncChannelT {
  switch (channel) {
    case NotificationChannel.EMAIL:
      return DncChannel.EMAIL;
    case NotificationChannel.SMS:
      return DncChannel.SMS;
    case NotificationChannel.WHATSAPP:
      return DncChannel.WHATSAPP;
    default:
      return DncChannel.ALL;
  }
}

export type IsBlockedInput = {
  channel: DncChannelT;
  value: string;
  at?: Date;
};

export async function isBlocked(
  input: IsBlockedInput,
  store?: DncStore,
): Promise<boolean> {
  const db = await resolveStore(store);
  const at = input.at ?? new Date();
  const normalised = normaliseValue(input.channel, input.value);
  if (!normalised) return false;
  const channels = lookupChannels(input.channel);
  const row = await db.leadDoNotCall.findFirst({
    where: {
      removedAt: null,
      normalisedValue: normalised,
      channel: { in: channels },
      effectiveFrom: { lte: at },
      OR: [{ effectiveUntil: null }, { effectiveUntil: { gt: at } }],
    },
  });
  return row != null;
}

/** Intake helper — phone DNC (channel PHONE or ALL). */
export async function isOnDoNotCallList(
  phone: string,
  store?: DncStore,
): Promise<boolean> {
  return isBlocked({ channel: DncChannel.PHONE, value: phone }, store);
}

export type AddDncInput = {
  channel: DncChannelT;
  value: string;
  reason: string;
  source?: DncSourceT;
  createdByUserId: string;
  sourceLeadId?: string | null;
  effectiveFrom?: Date;
  effectiveUntil?: Date | null;
  email?: string | null;
  phone?: string | null;
};

export async function addDnc(
  input: AddDncInput,
  store?: DncStore,
): Promise<LeadDoNotCall> {
  const db = await resolveStore(store);
  const now = input.effectiveFrom ?? new Date();
  const normalised = normaliseValue(input.channel, input.value);
  const phone =
    input.phone ??
    (input.channel === DncChannel.EMAIL ? "" : normalised);
  const email =
    input.email ??
    (input.channel === DncChannel.EMAIL ? normalised : null);

  const existing = await db.leadDoNotCall.findFirst({
    where: {
      channel: input.channel,
      normalisedValue: normalised,
      removedAt: null,
    },
  });

  const data = {
    phone,
    email,
    reason: input.reason,
    addedByUserId: input.createdByUserId === "SYSTEM" ? null : input.createdByUserId,
    addedAt: now,
    expiresAt: input.effectiveUntil ?? null,
    source: input.source ?? DncSource.MANUAL,
    channel: input.channel,
    value: normalised,
    normalisedValue: normalised,
    sourceLeadId: input.sourceLeadId ?? null,
    effectiveFrom: now,
    effectiveUntil: input.effectiveUntil ?? null,
    createdByUserId: input.createdByUserId,
    removedAt: null,
    removalAuthorityUserId: null,
    removalNote: null,
  };

  const row = existing
    ? await db.leadDoNotCall.update({
        where: { id: existing.id },
        data: {
          reason: input.reason,
          email,
          expiresAt: input.effectiveUntil ?? null,
          effectiveUntil: input.effectiveUntil ?? null,
          source: input.source ?? DncSource.MANUAL,
        },
      })
    : await db.leadDoNotCall.create({ data });

  if (db.lead && phone) {
    await db.lead.updateMany({
      where: { phone: { in: [input.value, phone, normalised].filter(Boolean) } },
      data: { doNotCallFlag: true },
    });
  }

  return dncToDomain(row as never);
}

export async function addDncFromLeadContact(
  input: {
    phone: string;
    email?: string | null;
    reason: string;
    createdByUserId: string;
    source?: DncSourceT;
    sourceLeadId?: string | null;
  },
  store?: DncStore,
): Promise<LeadDoNotCall[]> {
  const rows: LeadDoNotCall[] = [];
  rows.push(
    await addDnc(
      {
        channel: DncChannel.PHONE,
        value: input.phone,
        reason: input.reason,
        createdByUserId: input.createdByUserId,
        source: input.source ?? DncSource.OPS_ADD,
        sourceLeadId: input.sourceLeadId,
        phone: input.phone,
        email: input.email ?? null,
      },
      store,
    ),
  );
  if (input.email) {
    rows.push(
      await addDnc(
        {
          channel: DncChannel.EMAIL,
          value: input.email,
          reason: input.reason,
          createdByUserId: input.createdByUserId,
          source: input.source ?? DncSource.OPS_ADD,
          sourceLeadId: input.sourceLeadId,
          phone: input.phone,
          email: input.email,
        },
        store,
      ),
    );
  }
  return rows;
}

export type ListDncQuery = {
  channel?: DncChannelT;
  value?: string;
  includeRemoved?: boolean;
  take?: number;
};

export async function listDnc(
  query: ListDncQuery = {},
  store?: DncStore,
): Promise<LeadDoNotCall[]> {
  const db = await resolveStore(store);
  const where: Record<string, unknown> = {};
  if (!query.includeRemoved) where.removedAt = null;
  if (query.channel) where.channel = query.channel;
  if (query.value) {
    where.normalisedValue = query.channel
      ? normaliseValue(query.channel, query.value)
      : query.value.includes("@")
        ? normaliseEmail(query.value)
        : normalisePhone(query.value);
  }
  const rows = await db.leadDoNotCall.findMany({
    where,
    orderBy: { addedAt: "desc" },
    take: query.take ?? 200,
  });
  return rows.map((r) => dncToDomain(r as never));
}

export async function getDncById(
  id: string,
  store?: DncStore,
): Promise<LeadDoNotCall | null> {
  const db = await resolveStore(store);
  const row = await db.leadDoNotCall.findUnique({ where: { id } });
  return row ? dncToDomain(row as never) : null;
}

export async function removeDnc(
  id: string,
  input: { authorityUserId: string; authorityNote: string },
  store?: DncStore,
): Promise<LeadDoNotCall> {
  const db = await resolveStore(store);
  const note = input.authorityNote.trim();
  if (!note) {
    throw new Error("Authority note is required to remove a DNC entry");
  }
  const row = await db.leadDoNotCall.update({
    where: { id },
    data: {
      removedAt: new Date(),
      removalAuthorityUserId: input.authorityUserId,
      removalNote: note,
    },
  });
  return dncToDomain(row as never);
}

export async function checkDncBulk(
  items: Array<{ channel: DncChannelT; value: string }>,
  store?: DncStore,
): Promise<Array<{ channel: DncChannelT; value: string; blocked: boolean }>> {
  const out: Array<{ channel: DncChannelT; value: string; blocked: boolean }> = [];
  for (const item of items) {
    out.push({
      ...item,
      blocked: await isBlocked(item, store),
    });
  }
  return out;
}
