import { DncChannel, DncSource } from "../domain/enums";
import { normaliseEmail, normalisePhone } from "./dnc";

export type MigrateDncDb = {
  leadDoNotCall: {
    findMany: (args: object) => Promise<
      Array<{
        id: string;
        phone: string;
        email: string | null;
        reason: string;
        source: string;
        addedByUserId: string | null;
        addedAt: Date;
        expiresAt: Date | null;
        channel: string;
        normalisedValue: string;
        createdByUserId: string;
        createdAt: Date;
        updatedAt: Date;
        removedAt: Date | null;
      }>
    >;
    create: (args: object) => Promise<{ id: string }>;
    update: (args: object) => Promise<{ id: string }>;
  };
};

export type MigrateDncSummary = {
  scanned: number;
  phonesNormalised: number;
  emailsInserted: number;
};

export async function migrateDncToV2(db: MigrateDncDb): Promise<MigrateDncSummary> {
  const rows = await db.leadDoNotCall.findMany({ where: { removedAt: null } });
  let phonesNormalised = 0;
  let emailsInserted = 0;

  for (const row of rows) {
    if (row.channel === DncChannel.PHONE || row.phone) {
      const e164 = normalisePhone(row.phone || row.normalisedValue);
      if (e164 && e164 !== row.normalisedValue) {
        await db.leadDoNotCall.update({
          where: { id: row.id },
          data: { value: e164, normalisedValue: e164, channel: DncChannel.PHONE },
        });
        phonesNormalised += 1;
      }
    }

    if (row.email) {
      const emailNorm = normaliseEmail(row.email);
      const exists = rows.some(
        (r) =>
          r.channel === DncChannel.EMAIL &&
          r.normalisedValue === emailNorm &&
          r.removedAt == null,
      );
      if (!exists) {
        await db.leadDoNotCall.create({
          data: {
            phone: row.phone || "",
            email: emailNorm,
            reason: row.reason,
            addedByUserId: row.addedByUserId,
            addedAt: row.addedAt,
            expiresAt: row.expiresAt,
            source: DncSource.MANUAL,
            channel: DncChannel.EMAIL,
            value: emailNorm,
            normalisedValue: emailNorm,
            effectiveFrom: row.addedAt,
            effectiveUntil: row.expiresAt,
            createdByUserId: row.createdByUserId || "SYSTEM",
            createdAt: row.createdAt,
            updatedAt: row.updatedAt,
          },
        });
        emailsInserted += 1;
        rows.push({
          ...row,
          id: `new-${emailNorm}`,
          channel: DncChannel.EMAIL,
          normalisedValue: emailNorm,
          email: emailNorm,
        });
      }
    }
  }

  return { scanned: rows.length, phonesNormalised, emailsInserted };
}
