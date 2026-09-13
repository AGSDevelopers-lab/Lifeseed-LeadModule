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

export type LeadConversionPortMode = "off" | "on";

/**
 * Default `off` in production (legacy convert path).
 * Default `on` in non-production for shadow testing.
 */
export function isLeadConversionPortEnabled(
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  const raw = env.LEAD_CONVERSION_PORT_ENABLED;
  if (raw === "on") return true;
  if (raw === "off") return false;
  if (env.VERCEL_ENV === "production" || env.NODE_ENV === "production") {
    return false;
  }
  return true;
}

export type LeadNotificationPortMode = "off" | "in_app_only" | "on";

export function getLeadNotificationPortMode(env?: {
  LEAD_NOTIFICATION_PORT_ENABLED?: string;
}): LeadNotificationPortMode {
  const raw = env?.LEAD_NOTIFICATION_PORT_ENABLED ?? process.env.LEAD_NOTIFICATION_PORT_ENABLED;
  if (raw === "off" || raw === "in_app_only" || raw === "on") return raw;
  return "in_app_only";
}

/** B12 per-channel flags. Default OFF unless the exact value `on` is set. */
export function isLeadSmsEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return (env.LEAD_SMS_ENABLED ?? process.env.LEAD_SMS_ENABLED) === "on";
}

export function isLeadEmailEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return (env.LEAD_EMAIL_ENABLED ?? process.env.LEAD_EMAIL_ENABLED) === "on";
}

export function isLeadWhatsappEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return (env.LEAD_WHATSAPP_ENABLED ?? process.env.LEAD_WHATSAPP_ENABLED) === "on";
}

export function isLeadOutboundChannelFlagOn(
  channel: "EMAIL" | "SMS" | "WHATSAPP" | "IN_APP",
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  if (channel === "IN_APP") return true;
  if (channel === "SMS") return isLeadSmsEnabled(env);
  if (channel === "EMAIL") return isLeadEmailEnabled(env);
  return isLeadWhatsappEnabled(env);
}

/** Port mode + channel flag must both allow I/O before a vendor adapter may network. */
export function mayDispatchVendorAdapter(
  channel: "EMAIL" | "SMS" | "WHATSAPP" | "IN_APP",
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  const mode = getLeadNotificationPortMode(env);
  if (mode === "off") return false;
  if (channel === "IN_APP") return mode === "in_app_only" || mode === "on";
  if (mode !== "on") return false;
  return isLeadOutboundChannelFlagOn(channel, env);
}

/**
 * B13 staged assignment (site + capacity + active eligibility).
 * Default OFF — never activate for production without Founder cutover.
 * When off, legacy round-robin in lead-assignment.ts is unchanged.
 */
export function isLeadAssignmentV2Enabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return (env.LEAD_ASSIGNMENT_V2_ENABLED ?? process.env.LEAD_ASSIGNMENT_V2_ENABLED) === "on";
}

/**
 * B14 DuplicateCase detection + review merge. Default OFF.
 * Never activate for production without Founder cutover.
 */
export function isLeadDuplicateEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return (env.LEAD_DUPLICATE_ENABLED ?? process.env.LEAD_DUPLICATE_ENABLED) === "on";
}

/**
 * B15 attribution capture. Default OFF.
 * Gates captureTouch on intake only — Campaign CRUD and CAC are RBAC-gated, not flag-gated.
 * Never activate for production without Founder cutover.
 */
export function isLeadAttributionEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return (env.LEAD_ATTRIBUTION_ENABLED ?? process.env.LEAD_ATTRIBUTION_ENABLED) === "on";
}

export type LeadFollowUpMode = "off" | "on";

/**
 * Default `off` in production (safe rollout).
 * Default `on` in non-production.
 */
export function isLeadFollowUpEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  const raw = env.LEAD_FOLLOWUP_ENABLED;
  if (raw === "on") return true;
  if (raw === "off") return false;
  if (env.VERCEL_ENV === "production" || env.NODE_ENV === "production") {
    return false;
  }
  return true;
}

/**
 * UI/product rollout for counselling history/calendar vs legacy single-booking UI.
 * Default ON. Must not gate authoritative counselling writes.
 */
export function isLeadCounsellingHistoryEnabled(
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  const raw = env.LEAD_COUNSELLING_HISTORY_ENABLED;
  if (raw === "off") return false;
  return true;
}
