export type LeadStateMachineMode = "off" | "shadow" | "on" | "strict";

export function getLeadStateMachineMode(
  env: NodeJS.ProcessEnv = process.env,
): LeadStateMachineMode {
  const raw = env.LEAD_STATE_MACHINE_ENABLED;
  if (raw === "off" || raw === "shadow" || raw === "on" || raw === "strict") {
    return raw;
  }
  if (env.VERCEL_ENV === "production" || env.NODE_ENV === "production") {
    return "off";
  }
  return "shadow";
}

export function stateMachinePersistsSideEffects(mode: LeadStateMachineMode): boolean {
  return mode === "shadow" || mode === "on" || mode === "strict";
}

export function legacyDirectStatusWritesThrow(mode: LeadStateMachineMode): boolean {
  return mode === "strict";
}

export type LeadOutboxMode = "off" | "on";

/** Dispatcher only. Outbox rows still accumulate when off (no data loss). */
export function isLeadOutboxEnabled(env?: {
  LEAD_OUTBOX_ENABLED?: string;
}): boolean {
  const flag = env?.LEAD_OUTBOX_ENABLED ?? process.env.LEAD_OUTBOX_ENABLED;
  return flag === "on";
}
