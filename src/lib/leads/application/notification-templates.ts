import { DeliveryStatus, NotificationChannel } from "../domain/enums";
import { audit } from "@/lib/audit";

export class TemplateSodViolationError extends Error {
  readonly code = "TEMPLATE_SOD_VIOLATION";
  constructor() {
    super("Template author cannot approve");
    this.name = "TemplateSodViolationError";
  }
}

export type TemplateDb = {
  notificationTemplate: {
    findMany: (args: object) => Promise<Array<Record<string, unknown>>>;
    findFirst: (args: object) => Promise<Record<string, unknown> | null>;
    findUnique: (args: object) => Promise<Record<string, unknown> | null>;
    create: (args: { data: object }) => Promise<Record<string, unknown>>;
    update: (args: object) => Promise<Record<string, unknown>>;
    updateMany: (args: object) => Promise<unknown>;
  };
  notificationDeliveryLog: {
    findMany: (args: object) => Promise<Array<Record<string, unknown>>>;
    updateMany: (args: object) => Promise<{ count: number }>;
  };
  auditLog: {
    findFirst: (args: object) => Promise<{ actorUserId: string | null } | null>;
  };
};

export async function listNotificationTemplates(db: TemplateDb) {
  return db.notificationTemplate.findMany({
    orderBy: [{ key: "asc" }, { channel: "asc" }, { version: "desc" }],
  });
}

export async function proposeNotificationTemplate(
  db: TemplateDb,
  input: {
    key: string;
    channel: string;
    provider: string;
    subject?: string | null;
    body: string;
    variables: unknown;
    language: string;
    actorUserId: string;
  },
) {
  const latest = await db.notificationTemplate.findFirst({
    where: { key: input.key, channel: input.channel, language: input.language },
    orderBy: { version: "desc" },
  });
  const version = typeof latest?.version === "number" ? latest.version + 1 : 1;
  const row = await db.notificationTemplate.create({
    data: {
      key: input.key,
      channel: input.channel,
      provider: input.provider,
      subject: input.subject ?? null,
      body: input.body,
      variables: input.variables,
      language: input.language,
      version,
      isActive: false,
      approvedByUserId: null,
      approvedAt: null,
    },
  });
  await audit.log({
    actorUserId: input.actorUserId,
    action: "notification.template.propose",
    entityType: "NotificationTemplate",
    entityId: String(row.id),
    afterJson: { key: input.key, version },
  });
  return row;
}

export async function approveNotificationTemplate(
  db: TemplateDb,
  input: { id: string; actorUserId: string },
) {
  const row = await db.notificationTemplate.findUnique({ where: { id: input.id } });
  if (!row) throw new Error("TEMPLATE_NOT_FOUND");
  const lastPropose = await db.auditLog.findFirst({
    where: {
      entityType: "NotificationTemplate",
      entityId: input.id,
      action: "notification.template.propose",
    },
    orderBy: { timestamp: "desc" },
  });
  if (lastPropose?.actorUserId && lastPropose.actorUserId === input.actorUserId) {
    throw new TemplateSodViolationError();
  }
  await db.notificationTemplate.updateMany({
    where: {
      key: row.key,
      channel: row.channel,
      language: row.language,
      isActive: true,
    },
    data: { isActive: false },
  });
  const updated = await db.notificationTemplate.update({
    where: { id: input.id },
    data: {
      isActive: true,
      approvedByUserId: input.actorUserId,
      approvedAt: new Date(),
    },
  });
  await audit.log({
    actorUserId: input.actorUserId,
    action: "notification.template.approve",
    entityType: "NotificationTemplate",
    entityId: input.id,
  });
  return updated;
}

export async function listDeliveryLogs(
  db: TemplateDb,
  filters: {
    leadId?: string;
    channel?: string;
    status?: string;
    from?: Date;
    to?: Date;
  },
) {
  return db.notificationDeliveryLog.findMany({
    where: {
      ...(filters.leadId ? { leadId: filters.leadId } : {}),
      ...(filters.channel ? { channel: filters.channel } : {}),
      ...(filters.status ? { deliveryStatus: filters.status } : {}),
      ...(filters.from || filters.to
        ? {
            sentAt: {
              ...(filters.from ? { gte: filters.from } : {}),
              ...(filters.to ? { lte: filters.to } : {}),
            },
          }
        : {}),
    },
    orderBy: { sentAt: "desc" },
    take: 200,
  });
}

export function mapVendorStatus(raw: string): (typeof DeliveryStatus)[keyof typeof DeliveryStatus] | null {
  const n = raw.toLowerCase();
  if (n.includes("bounce")) return DeliveryStatus.BOUNCED;
  if (n.includes("fail") || n.includes("undelivered")) return DeliveryStatus.FAILED;
  if (n.includes("deliver")) return DeliveryStatus.DELIVERED;
  if (n.includes("queued") || n.includes("accepted")) return DeliveryStatus.QUEUED;
  if (n === "sent" || n.endsWith(".sent")) return DeliveryStatus.SENT;
  if (n.includes("read")) return DeliveryStatus.READ;
  if (n.includes("replied")) return DeliveryStatus.REPLIED;
  return null;
}

export async function applyDeliveryWebhookUpdate(
  db: TemplateDb,
  input: { providerMessageId: string; status: string; failureReason?: string | null },
): Promise<{ count: number }> {
  const mapped = mapVendorStatus(input.status);
  if (!mapped) return { count: 0 };
  return db.notificationDeliveryLog.updateMany({
    where: { providerMessageId: input.providerMessageId },
    data: {
      deliveryStatus: mapped,
      statusUpdatedAt: new Date(),
      failureReason: input.failureReason ?? null,
    },
  });
}

export { NotificationChannel };
