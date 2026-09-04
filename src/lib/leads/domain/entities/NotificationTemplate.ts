import type { LeadLanguage, NotificationChannel, NotificationProvider } from "../enums";

export interface NotificationTemplate {
  id: string;
  key: string;
  channel: NotificationChannel;
  provider: NotificationProvider;
  subject: string | null;
  body: string;
  variables: unknown;
  language: LeadLanguage;
  version: number;
  isActive: boolean;
  approvedByUserId: string | null;
  approvedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}
