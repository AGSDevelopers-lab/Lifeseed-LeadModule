import { prismaLeadRepository, countAssignedOpenLeads } from "../adapters/prisma-lead-repository";
import {
  createPrismaAssignmentDirectory,
  loadAssignmentRules,
  lookupUserSiteAndActive,
} from "../adapters/prisma-assignment-directory";
import type { Lead } from "../domain/entities/Lead";
import { LeadOwnershipDeniedError } from "../domain/errors";
import type { ActorContext } from "../domain/ports/shared";
import type { LeadStatus } from "../domain/enums";
import {
  actorHasAssignmentOverride,
  assertSrTelecallerOwnPool,
  computeAssigneeAvailable,
  eligibleCandidates,
  pickFairRotate,
  siteMatchesCandidate,
} from "./assignment-policy";
import { isLeadAssignmentV2Enabled } from "./feature-flag";

export async function computeGenuineAssigneeAvailable(
  lead: Lead,
  actor: ActorContext,
): Promise<boolean> {
  const rules = await loadAssignmentRules();
  const directory = await createPrismaAssignmentDirectory();
  const override = actorHasAssignmentOverride(actor);
  const listed = await directory.listAvailableTelecallers(
    override ? undefined : lead.props.ownership.siteId,
  );
  return computeAssigneeAvailable(
    listed,
    lead.props.ownership.siteId,
    override,
    rules,
  );
}

export async function assertExplicitAssigneeAllowed(
  actor: ActorContext,
  assigneeUserId: string,
  lead: Lead,
  mode: "assign" | "reassign",
): Promise<void> {
  const target = await lookupUserSiteAndActive(assigneeUserId);
  if (!target || !target.isActive) {
    throw new LeadOwnershipDeniedError("Assignee is not an active user", {
      assigneeUserId,
    });
  }
  if (mode === "reassign") {
    assertSrTelecallerOwnPool(actor, target.siteId);
  }
  if (!isLeadAssignmentV2Enabled()) return;

  const rules = await loadAssignmentRules();
  const override = actorHasAssignmentOverride(actor);
  if (
    !siteMatchesCandidate(
      target.siteId,
      lead.props.ownership.siteId,
      override,
      rules,
    )
  ) {
    throw new LeadOwnershipDeniedError(
      "Cross-site assignment requires assignment.override",
      {
        leadSiteId: lead.props.ownership.siteId,
        assigneeSiteId: target.siteId,
      },
    );
  }
  const open = await countAssignedOpenLeads(
    assigneeUserId,
    rules.openStatuses as LeadStatus[],
  );
  if (open >= rules.maxQueuePerTelecaller) {
    throw new LeadOwnershipDeniedError("Assignee is at capacity", {
      assigneeUserId,
      open,
      cap: rules.maxQueuePerTelecaller,
    });
  }
}

export async function pickV2Assignee(
  leadSiteId: string | null,
  actor: ActorContext,
): Promise<string | null> {
  const rules = await loadAssignmentRules();
  if (!rules.autoAssignEnabled) return null;
  const directory = await createPrismaAssignmentDirectory();
  const override = actorHasAssignmentOverride(actor);
  const listed = await directory.listAvailableTelecallers(
    override ? undefined : leadSiteId,
  );
  const eligible = eligibleCandidates(listed, leadSiteId, override, rules);
  return pickFairRotate(eligible);
}

export async function loadLeadForAssignment(leadId: string, actor: ActorContext) {
  return prismaLeadRepository.byId(leadId, actor);
}
