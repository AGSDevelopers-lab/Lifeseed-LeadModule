import { audit } from "@/lib/audit";

export type LeadDenialAuditInput = {
  actorUserId: string | null;
  actorRoles: readonly string[];
  leadId: string;
  denialReason: string;
  requiredPermission: string;
  siteId?: string | null;
};

export type LeadViewAuditInput = {
  actorUserId: string | null;
  actorRoles: readonly string[];
  leadId: string;
  siteId?: string | null;
};

export type LeadAccessAuditor = {
  recordDenied(input: LeadDenialAuditInput): Promise<void>;
  recordView(input: LeadViewAuditInput): Promise<void>;
};

/** Hash-chain audit helper for lead IDOR denials and successful detail views. */
export class PrismaLeadAudit implements LeadAccessAuditor {
  async recordDenied(input: LeadDenialAuditInput): Promise<void> {
    await audit.log({
      actorUserId: input.actorUserId,
      action: "lead.access.denied",
      entityType: "Lead",
      entityId: input.leadId,
      afterJson: {
        denialReason: input.denialReason,
        requiredPermission: input.requiredPermission,
        actorRoles: [...input.actorRoles],
        siteId: input.siteId ?? null,
      },
    });
  }

  async recordView(input: LeadViewAuditInput): Promise<void> {
    await audit.log({
      actorUserId: input.actorUserId,
      action: "lead.view",
      entityType: "Lead",
      entityId: input.leadId,
      afterJson: {
        actorRoles: [...input.actorRoles],
        siteId: input.siteId ?? null,
      },
    });
  }
}

export const prismaLeadAudit = new PrismaLeadAudit();
