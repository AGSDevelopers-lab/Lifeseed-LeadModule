import type { ActorContext } from "../../domain/ports/shared";
import type {
  LeadListFilters,
  LeadListPage,
  LeadRepository,
} from "../../domain/ports/LeadRepository";
import { Lead } from "../../domain/entities/Lead";
import { LeadOwnershipDeniedError } from "../../domain/errors";
import { evaluateLeadAccess } from "../../adapters/lead-access-scope";

export class InMemoryLeadRepository implements LeadRepository {
  private readonly byIdMap = new Map<string, Lead>();

  async byId(id: string, ctx?: ActorContext): Promise<Lead | null> {
    const lead = this.byIdMap.get(id) ?? null;
    if (!lead) return null;
    if (ctx) {
      const decision = evaluateLeadAccess(
        {
          leadId: lead.id,
          assignedTelecallerId: lead.props.ownership.assignedTelecallerId,
          counsellorUserId: null,
          siteId: lead.props.ownership.siteId,
        },
        ctx,
      );
      if (!decision.allowed) {
        throw new LeadOwnershipDeniedError("Lead not in caller scope", {
          leadId: id,
          userId: ctx.userId,
          denialReason: decision.denialReason,
          requiredPermission: decision.requiredPermission,
        });
      }
    }
    return lead;
  }

  async list(actor: ActorContext, filters?: LeadListFilters): Promise<LeadListPage> {
    const items: Lead[] = [];
    for (const lead of this.byIdMap.values()) {
      try {
        const row = await this.byId(lead.id, actor);
        if (row) items.push(row);
      } catch {
        /* ownership denied */
      }
    }
    const filtered = this.filterItems(items, filters);
    const limit = filters?.limit ?? 50;
    return { items: filtered.slice(0, limit), nextCursor: null };
  }

  async count(actor: ActorContext, filters?: LeadListFilters): Promise<number> {
    const page = await this.list(actor, { ...filters, limit: 10_000 });
    return page.items.length;
  }

  async groupBySource(actor: ActorContext, filters?: LeadListFilters) {
    const page = await this.list(actor, { ...filters, limit: 10_000 });
    const map = new Map<string, number>();
    for (const lead of page.items) {
      const s = String(lead.props.source);
      map.set(s, (map.get(s) ?? 0) + 1);
    }
    return [...map.entries()].map(([source, count]) => ({ source, count }));
  }

  private filterItems(items: Lead[], filters?: LeadListFilters): Lead[] {
    if (!filters) return items;
    return items.filter((l) => {
      if (filters.status && l.status !== filters.status) return false;
      if (filters.statuses && !filters.statuses.includes(l.status)) return false;
      if (filters.statusNot && l.status === filters.statusNot) return false;
      if (filters.statusNotIn?.includes(l.status)) return false;
      return true;
    });
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
