import { LeadStatus } from "@prisma/client";

/** Admin / logistics funnel multi-status OR groups (CONFLICT-27). */
export const FUNNEL_CONTACTED_STATUSES: LeadStatus[] = [
  LeadStatus.CONTACTED_QUALIFIED,
  LeadStatus.CONTACTED_NOT_INTERESTED,
  LeadStatus.CONTACTED_CALLBACK_REQUESTED,
  LeadStatus.COUNSELLING_BOOKED,
  LeadStatus.COUNSELLING_ATTENDED,
  LeadStatus.COUNSELLING_NO_SHOW,
  LeadStatus.CONVERTED,
];

export const FUNNEL_COUNSELLED_STATUSES: LeadStatus[] = [
  LeadStatus.COUNSELLING_ATTENDED,
  LeadStatus.CONVERTED,
];

export function countFunnelStage(
  statuses: Array<{ status: LeadStatus }>,
  group: LeadStatus[],
): number {
  const set = new Set(group);
  return statuses.filter((r) => set.has(r.status)).length;
}
