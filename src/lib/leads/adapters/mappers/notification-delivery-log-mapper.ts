import type { NotificationDeliveryLog } from "../../domain/entities/NotificationDeliveryLog";
import type {
  DeliveryStatus,
  NotificationChannel,
  NotificationProvider,
} from "../../domain/enums";

export type PrismaNotificationDeliveryLogRow = {
  id: string;
  leadId: string | null;
  templateId: string;
  channel: string;
  provider: string;
  recipient: string;
  sentAt: Date;
  providerMessageId: string | null;
  deliveryStatus: string;
  statusUpdatedAt: Date | null;
  failureReason: string | null;
  dncCheckedAt: Date;
  dncPassed: boolean;
  payloadHash: string | null;
};

export function notificationDeliveryLogToDomain(
  row: PrismaNotificationDeliveryLogRow,
): NotificationDeliveryLog {
  return {
    id: row.id,
    leadId: row.leadId,
    templateId: row.templateId,
    channel: row.channel as NotificationChannel,
    provider: row.provider as NotificationProvider,
    recipient: row.recipient,
    sentAt: row.sentAt,
    providerMessageId: row.providerMessageId,
    deliveryStatus: row.deliveryStatus as DeliveryStatus,
    statusUpdatedAt: row.statusUpdatedAt,
    failureReason: row.failureReason,
    dncCheckedAt: row.dncCheckedAt,
    dncPassed: row.dncPassed,
    payloadHash: row.payloadHash,
  };
}

export function notificationDeliveryLogToPrisma(
  entity: NotificationDeliveryLog,
): PrismaNotificationDeliveryLogRow {
  return { ...entity };
}

export const toDomain = notificationDeliveryLogToDomain;
export const toPrisma = notificationDeliveryLogToPrisma;
