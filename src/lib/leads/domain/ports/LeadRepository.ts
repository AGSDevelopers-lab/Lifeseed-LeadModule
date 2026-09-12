import type { Lead } from "../entities/Lead";
import type { ActorContext } from "./shared";

export type LeadListPurpose = "list" | "export";

export type LeadListFilters = {
  source?: string;
  tier?: string;
  status?: string;
  /** Multi-status OR (CONFLICT-27). Used when `status` is unset. */
  statuses?: string[];
  statusNot?: string;
  statusNotIn?: string[];
  outcome?: string;
  isArchived?: boolean;
  personType?: string;
  siteId?: string;
  campaignId?: string;
  from?: Date;
  to?: Date;
  telecallerId?: string;
  cursor?: string;
  limit?: number;
  purpose?: LeadListPurpose;
  slaResponseDueBefore?: Date;
  convertedAtFrom?: Date;
  convertedByUserId?: string;
  retentionExpiresAtTo?: Date;
};

export type LeadSourceCount = {
  source: string;
  count: number;
};

export type LeadListPage = {
  items: Lead[];
  nextCursor: string | null;
};

export interface LeadRepository {
  byId(id: string, ctx?: ActorContext): Promise<Lead | null>;
  list(actor: ActorContext, filters?: LeadListFilters): Promise<LeadListPage>;
  /** Scoped aggregate — CONFLICT-25. */
  count(actor: ActorContext, filters?: LeadListFilters): Promise<number>;
  groupBySource(actor: ActorContext, filters?: LeadListFilters): Promise<LeadSourceCount[]>;
  create(lead: Lead): Promise<Lead>;
  update(lead: Lead): Promise<Lead>;
}
