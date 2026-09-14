/**
 * Permission strings the counselling mutation commands pass to `applyLeadEvent`.
 * Kept beside the commands so B17-A `resolveLeadActions` imports the same values
 * without rewriting `counselling.ts` (B11 closed file).
 */
export const COUNSELLING_RESCHEDULE_PERMISSION = "counselling.reschedule" as const;
export const COUNSELLING_CANCEL_PERMISSION = "counselling.cancel" as const;
