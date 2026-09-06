import type { NotificationTemplate } from "../../domain/entities/NotificationTemplate";
import type {
  LeadLanguage,
  NotificationChannel,
  NotificationProvider,
} from "../../domain/enums";

export type PrismaNotificationTemplateRow = {
  id: string;
  key: string;
  channel: string;
  provider: string;
  subject: string | null;
  body: string;
  variables: unknown;
  language: string;
  version: number;
  isActive: boolean;
  approvedByUserId: string | null;
  approvedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

export function notificationTemplateToDomain(
  row: PrismaNotificationTemplateRow,
): NotificationTemplate {
  return {
    id: row.id,
    key: row.key,
    channel: row.channel as NotificationChannel,
    provider: row.provider as NotificationProvider,
    subject: row.subject,
    body: row.body,
    variables: row.variables,
    language: row.language as LeadLanguage,
    version: row.version,
    isActive: row.isActive,
    approvedByUserId: row.approvedByUserId,
    approvedAt: row.approvedAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export function notificationTemplateToPrisma(
  entity: NotificationTemplate,
): PrismaNotificationTemplateRow {
  return { ...entity };
}

export const toDomain = notificationTemplateToDomain;
export const toPrisma = notificationTemplateToPrisma;
