import type { Lead } from "../entities/Lead";
import type { ActorContext } from "./shared";

export interface LeadRepository {
  byId(id: string, ctx?: ActorContext): Promise<Lead | null>;
  create(lead: Lead): Promise<Lead>;
  update(lead: Lead): Promise<Lead>;
}
