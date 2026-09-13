export const B12_TEMPLATE_KEYS = [
  "lead.intake.welcome",
  "counselling_reminder_24h",
  "counselling_reminder_2h",
  "lead.followup.reminder",
  "lead.sla.breach.alert",
] as const;

export type B12TemplateKey = (typeof B12_TEMPLATE_KEYS)[number];

export const B12_SEED_CHANNELS = ["EMAIL", "SMS", "WHATSAPP"] as const;

const PROVIDER: Record<(typeof B12_SEED_CHANNELS)[number], string> = {
  EMAIL: "RESEND",
  SMS: "SMS_MAGIC",
  WHATSAPP: "META_WHATSAPP",
};

/** Non-patient structural body only. Inactive and unapproved. */
export const B12_STRUCTURAL_BODY = "{{body}}";

export type TemplateSeedDb = {
  notificationTemplate: {
    findFirst: (args: object) => Promise<{ id: string } | null>;
    create: (args: { data: object }) => Promise<{ id: string }>;
  };
};

export async function seedB12NotificationTemplateStructure(
  db: TemplateSeedDb,
): Promise<{ inserted: number; skipped: number }> {
  let inserted = 0;
  let skipped = 0;
  for (const key of B12_TEMPLATE_KEYS) {
    for (const channel of B12_SEED_CHANNELS) {
      const existing = await db.notificationTemplate.findFirst({
        where: { key, channel, language: "ENGLISH", version: 1 },
      });
      if (existing) {
        skipped += 1;
        continue;
      }
      await db.notificationTemplate.create({
        data: {
          key,
          channel,
          provider: PROVIDER[channel],
          subject: channel === "EMAIL" ? key : null,
          body: B12_STRUCTURAL_BODY,
          variables: ["body"],
          language: "ENGLISH",
          version: 1,
          isActive: false,
          approvedByUserId: null,
          approvedAt: null,
        },
      });
      inserted += 1;
    }
  }
  return { inserted, skipped };
}
