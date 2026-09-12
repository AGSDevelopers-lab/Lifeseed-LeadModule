import type { Lead } from "@/lib/leads/domain/entities/Lead";

export function serializeLeadListItem(lead: Lead) {
  return {
    leadId: lead.id,
    leadCode: lead.code.toString(),
    personType: lead.props.personType,
    status: lead.status,
    outcome: lead.props.outcome,
    isArchived: lead.props.isArchived,
    source: lead.props.source,
    assignedTelecallerId: lead.props.ownership.assignedTelecallerId,
    capturedAt: lead.props.retention.capturedAt.toISOString(),
    fullName: lead.props.contact.fullName,
    tier: lead.props.latestScore?.tier ?? null,
  };
}
