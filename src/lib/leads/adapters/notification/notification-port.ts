import { createHash } from "node:crypto";

import {
  DeliveryStatus,
  NotificationChannel,
  NotificationProvider,
} from "../../domain/enums";
import type {
  NotificationPort,
  NotificationSendInput,
  NotificationSendResult,
} from "../../domain/ports/NotificationPort";
import {
  dncChannelForNotification,
  isBlocked,
  type DncStore,
} from "../../application/dnc";
import {
  getLeadNotificationPortMode,
  type LeadNotificationPortMode,
} from "../../application/feature-flag";
import type { NotificationChannelAdapter } from "./types";
import { InAppNotificationAdapter } from "./in-app-adapter";
import { ResendEmailAdapter } from "./resend-email-adapter";
import { SmsMagicAdapter } from "./sms-magic-adapter";
import { MetaWhatsappAdapter } from "./meta-whatsapp-adapter";

const PROVIDER_BY_CHANNEL: Record<
  (typeof NotificationChannel)[keyof typeof NotificationChannel],
  (typeof NotificationProvider)[keyof typeof NotificationProvider]
> = {
  EMAIL: NotificationProvider.RESEND,
  SMS: NotificationProvider.SMS_MAGIC,
  WHATSAPP: NotificationProvider.META_WHATSAPP,
  IN_APP: NotificationProvider.IN_APP,
};

const FALLBACK_TEMPLATE_ID: Record<string, string> = {
  EMAIL: "ntpl_sys_email",
  SMS: "ntpl_sys_sms",
  WHATSAPP: "ntpl_sys_whatsapp",
  IN_APP: "ntpl_sys_in_app",
};

export type DeliveryLogWriter = (row: {
  leadId: string | null;
  templateId: string;
  channel: string;
  provider: string;
  recipient: string;
  sentAt: Date;
  providerMessageId: string | null;
  deliveryStatus: string;
  failureReason: string | null;
  dncCheckedAt: Date;
  dncPassed: boolean;
  payloadHash: string | null;
}) => Promise<{ id: string }>;

export type TemplateResolver = (
  templateKey: string,
  channel: NotificationSendInput["channel"],
) => Promise<{ id: string }>;

export type DncGatedNotificationPortDeps = {
  isBlocked: (input: NotificationSendInput) => Promise<boolean>;
  writeLog: DeliveryLogWriter;
  adapters: Partial<Record<NotificationSendInput["channel"], NotificationChannelAdapter>>;
  resolveTemplate?: TemplateResolver;
  now?: () => Date;
  getMode?: () => LeadNotificationPortMode;
};

function payloadHash(data: Record<string, unknown>): string {
  return createHash("sha256").update(JSON.stringify(data)).digest("hex").slice(0, 32);
}

function allowOverride(input: NotificationSendInput): boolean {
  return input.respectDnc === false && Boolean(input.dncOverrideReason?.trim());
}

function adapterEnabled(mode: LeadNotificationPortMode): boolean {
  return mode !== "off";
}

export class DncGatedNotificationPort implements NotificationPort {
  constructor(private readonly deps: DncGatedNotificationPortDeps) {}

  async send(input: NotificationSendInput): Promise<NotificationSendResult> {
    const now = this.deps.now?.() ?? new Date();
    const dncCheckedAt = now;
    const onList = await this.deps.isBlocked(input);
    const override = allowOverride(input);
    const blocked = onList && !override;
    const template = this.deps.resolveTemplate
      ? await this.deps.resolveTemplate(input.templateKey, input.channel)
      : { id: FALLBACK_TEMPLATE_ID[input.channel] ?? "ntpl_sys_in_app" };
    const provider = PROVIDER_BY_CHANNEL[input.channel];

    if (blocked) {
      const log = await this.deps.writeLog({
        leadId: input.leadId ?? null,
        templateId: template.id,
        channel: input.channel,
        provider,
        recipient: input.recipient,
        sentAt: now,
        providerMessageId: null,
        deliveryStatus: DeliveryStatus.BLOCKED_DNC,
        failureReason: "DNC",
        dncCheckedAt,
        dncPassed: false,
        payloadHash: payloadHash(input.data),
      });
      return { blocked: true, reason: "DNC", deliveryId: log.id };
    }

    const mode = this.deps.getMode?.() ?? getLeadNotificationPortMode();
    let providerMessageId: string | null = null;
    if (adapterEnabled(mode)) {
      const adapter = this.deps.adapters[input.channel];
      if (!adapter) {
        throw new Error(`No notification adapter registered for ${input.channel}`);
      }
      const sent = await adapter.send(input);
      providerMessageId = sent.providerMessageId;
    }

    const log = await this.deps.writeLog({
      leadId: input.leadId ?? null,
      templateId: template.id,
      channel: input.channel,
      provider,
      recipient: input.recipient,
      sentAt: now,
      providerMessageId,
      deliveryStatus: DeliveryStatus.SENT,
      failureReason: null,
      dncCheckedAt,
      dncPassed: !onList,
      payloadHash: payloadHash(input.data),
    });
    return { blocked: false, deliveryId: log.id };
  }
}

export async function createPrismaNotificationPort(): Promise<DncGatedNotificationPort> {
  const { prisma } = await import("@/lib/db");
  const adapters = {
    IN_APP: new InAppNotificationAdapter(prisma as never),
    EMAIL: new ResendEmailAdapter(),
    SMS: new SmsMagicAdapter(),
    WHATSAPP: new MetaWhatsappAdapter(),
  };
  return new DncGatedNotificationPort({
    isBlocked: (input) =>
      isBlocked(
        {
          channel: dncChannelForNotification(input.channel),
          value: input.recipient,
        },
        prisma as unknown as DncStore,
      ),
    writeLog: async (row) =>
      prisma.notificationDeliveryLog.create({
        data: {
          leadId: row.leadId,
          templateId: row.templateId,
          channel: row.channel as never,
          provider: row.provider as never,
          recipient: row.recipient,
          sentAt: row.sentAt,
          providerMessageId: row.providerMessageId,
          deliveryStatus: row.deliveryStatus as never,
          failureReason: row.failureReason,
          dncCheckedAt: row.dncCheckedAt,
          dncPassed: row.dncPassed,
          payloadHash: row.payloadHash,
        },
        select: { id: true },
      }),
    adapters,
    resolveTemplate: async (templateKey, channel) => {
      const found = await prisma.notificationTemplate.findFirst({
        where: { key: templateKey, channel: channel as never },
        select: { id: true },
      });
      if (found) return found;
      return { id: FALLBACK_TEMPLATE_ID[channel] ?? "ntpl_sys_in_app" };
    },
  });
}
