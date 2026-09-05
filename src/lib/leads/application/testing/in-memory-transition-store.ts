import { Lead } from "../../domain/entities/Lead";
import type { DomainWrite } from "../../domain/state-machine/types";
import type { TransitionStore } from "../__apply-transition";

export class InMemoryTransitionStore implements TransitionStore {
  readonly leads = new Map<string, Lead>();
  history: Array<{ leadId: string; toStatus: string }> = [];
  activities: Array<{ leadId: string }> = [];
  outbox: Array<{ leadId: string }> = [];
  throwAfterWrites = false;

  seed(lead: Lead): void {
    this.leads.set(lead.id, lead);
  }

  async load(id: string): Promise<Lead | null> {
    return this.leads.get(id) ?? null;
  }

  async persistBundle(input: {
    lead: Lead;
    nextStatus: string;
    writes: DomainWrite[];
    actorUserId: string;
    actorRole: string | null;
    now: Date;
    throwAfterWrites?: boolean;
  }): Promise<{ status: string; latestHistoryToStatus: string | null }> {
    const snapLead = this.leads.get(input.lead.id) ?? input.lead;
    const snapHistory = [...this.history];
    const snapActivities = [...this.activities];
    const snapOutbox = [...this.outbox];
    try {
      for (const w of input.writes) {
        if (w.kind === "status_history") this.history.push({ leadId: input.lead.id, toStatus: w.toStatus });
        if (w.kind === "activity") this.activities.push({ leadId: input.lead.id });
        if (w.kind === "outbox") this.outbox.push({ leadId: input.lead.id });
      }
      if (input.throwAfterWrites || this.throwAfterWrites) {
        throw new Error("mid-transition failure");
      }
      const next = new Lead({
        ...input.lead.props,
        status: input.nextStatus as Lead["status"],
        version: input.lead.version + 1,
      });
      this.leads.set(input.lead.id, next);
      const latest = [...this.history].reverse().find((h) => h.leadId === input.lead.id);
      return { status: next.status, latestHistoryToStatus: latest?.toStatus ?? null };
    } catch (err) {
      this.leads.set(input.lead.id, snapLead);
      this.history = snapHistory;
      this.activities = snapActivities;
      this.outbox = snapOutbox;
      throw err;
    }
  }
}
