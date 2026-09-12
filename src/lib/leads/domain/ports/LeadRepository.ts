import type { Lead } from "../entities/Lead";
import type { ActorContext } from "./shared";

export type LeadListFilters = {
  source?: string;
  tier?: string;
  status?: string;
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
};

export type LeadListPage = {
  items: Lead[];
  nextCursor: string | null;
};

export interface LeadRepository {
  byId(id: string, ctx?: ActorContext): Promise<Lead | null>;
  list(actor: ActorContext, filters?: LeadListFilters): Promise<LeadListPage>;
  create(lead: Lead): Promise<Lead>;
  update(lead: Lead): Promise<Lead>;
}
