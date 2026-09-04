import type { ActorContext } from "../../domain/ports/shared";
import type { LeadRepository } from "../../domain/ports/LeadRepository";
import { Lead } from "../../domain/entities/Lead";
import { LeadOwnershipDeniedError } from "../../domain/errors";

export class InMemoryLeadRepository implements LeadRepository {
  private readonly byIdMap = new Map<string, Lead>();

  async byId(id: string, ctx?: ActorContext): Promise<Lead | null> {
    const lead = this.byIdMap.get(id) ?? null;
    if (!lead) return null;
    if (
      ctx &&
      ctx.roles.includes("TELECALLER") &&
      !ctx.roles.includes("BANK_SUPER_ADMIN") &&
      lead.props.ownership.assignedTelecallerId &&
      lead.props.ownership.assignedTelecallerId !== ctx.userId
    ) {
      throw new LeadOwnershipDeniedError("Lead not in caller scope", {
        leadId: id,
        userId: ctx.userId,
      });
    }
    return lead;
  }

  async create(lead: Lead): Promise<Lead> {
    this.byIdMap.set(lead.id, lead);
    return lead;
  }

  async update(lead: Lead): Promise<Lead> {
    this.byIdMap.set(lead.id, lead);
    return lead;
  }
}
