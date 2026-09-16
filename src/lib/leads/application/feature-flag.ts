export type LeadStateMachineMode = "off" | "shadow" | "on" | "strict";

export function getLeadStateMachineMode(
  env: Record<string, string | undefined> = process.env,
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
  env: Record<string, string | undefined> = process.env,
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
export function isLeadSmsEnabled(env: Record<string, string | undefined> = process.env): boolean {
  return (env.LEAD_SMS_ENABLED ?? process.env.LEAD_SMS_ENABLED) === "on";
}

export function isLeadEmailEnabled(env: Record<string, string | undefined> = process.env): boolean {
  return (env.LEAD_EMAIL_ENABLED ?? process.env.LEAD_EMAIL_ENABLED) === "on";
}

export function isLeadWhatsappEnabled(env: Record<string, string | undefined> = process.env): boolean {
  return (env.LEAD_WHATSAPP_ENABLED ?? process.env.LEAD_WHATSAPP_ENABLED) === "on";
}

export function isLeadOutboundChannelFlagOn(
  channel: "EMAIL" | "SMS" | "WHATSAPP" | "IN_APP",
  env: Record<string, string | undefined> = process.env,
): boolean {
  if (channel === "IN_APP") return true;
  if (channel === "SMS") return isLeadSmsEnabled(env);
  if (channel === "EMAIL") return isLeadEmailEnabled(env);
  return isLeadWhatsappEnabled(env);
}

/** Port mode + channel flag must both allow I/O before a vendor adapter may network. */
export function mayDispatchVendorAdapter(
  channel: "EMAIL" | "SMS" | "WHATSAPP" | "IN_APP",
  env: Record<string, string | undefined> = process.env,
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
export function isLeadAssignmentV2Enabled(env: Record<string, string | undefined> = process.env): boolean {
  return (env.LEAD_ASSIGNMENT_V2_ENABLED ?? process.env.LEAD_ASSIGNMENT_V2_ENABLED) === "on";
}

/**
 * B14 DuplicateCase detection + review merge. Default OFF.
 * Never activate for production without Founder cutover.
 */
export function isLeadDuplicateEnabled(env: Record<string, string | undefined> = process.env): boolean {
  return (env.LEAD_DUPLICATE_ENABLED ?? process.env.LEAD_DUPLICATE_ENABLED) === "on";
}

/**
 * B15 attribution capture. Default OFF.
 * Gates captureTouch on intake only — Campaign CRUD and CAC are RBAC-gated, not flag-gated.
 * Never activate for production without Founder cutover.
 */
export function isLeadAttributionEnabled(env: Record<string, string | undefined> = process.env): boolean {
  return (env.LEAD_ATTRIBUTION_ENABLED ?? process.env.LEAD_ATTRIBUTION_ENABLED) === "on";
}

export type LeadFollowUpMode = "off" | "on";

/**
 * Default `off` in production (safe rollout).
 * Default `on` in non-production.
 */
export function isLeadFollowUpEnabled(env: Record<string, string | undefined> = process.env): boolean {
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
  env: Record<string, string | undefined> = process.env,
): boolean {
  const raw = env.LEAD_COUNSELLING_HISTORY_ENABLED;
  if (raw === "off") return false;
  return true;
}

function envFlagTrue(raw: string | undefined): boolean {
  return raw === "true" || raw === "on";
}

/**
 * Master CRM sync worker switch. Default OFF.
 * Existing System A used `CRM_SYNC_ENABLED === "true"`; both `true` and `on` are accepted.
 */
export function isCrmSyncEnabled(env: Record<string, string | undefined> = process.env): boolean {
  return envFlagTrue(env.CRM_SYNC_ENABLED ?? process.env.CRM_SYNC_ENABLED);
}

/** Per-provider flag. Default OFF. Worker idles for that provider when off. */
export function isCrmZohoSyncEnabled(env: Record<string, string | undefined> = process.env): boolean {
  return envFlagTrue(env.CRM_SYNC_ZOHO_ENABLED ?? process.env.CRM_SYNC_ZOHO_ENABLED);
}

/** Per-provider flag. Default OFF. Worker idles for that provider when off. */
export function isCrmSalesforceSyncEnabled(env: Record<string, string | undefined> = process.env): boolean {
  return envFlagTrue(
    env.CRM_SYNC_SALESFORCE_ENABLED ?? process.env.CRM_SYNC_SALESFORCE_ENABLED,
  );
}

/**
 * B17-A Lead 360 detail surface + three read routes.
 * Default OFF everywhere (including dev/staging) unless the exact value `on` is set.
 * Never activate in production without a separate Founder decision.
 */
export function isLead360Enabled(env: Record<string, string | undefined> = process.env): boolean {
  return (env.LEAD_360_ENABLED ?? process.env.LEAD_360_ENABLED) === "on";
}

export function isCrmProviderSyncEnabled(
  target: "ZOHO" | "SALESFORCE",
  env: Record<string, string | undefined> = process.env,
): boolean {
  if (target === "ZOHO") return isCrmZohoSyncEnabled(env);
  return isCrmSalesforceSyncEnabled(env);
}

/** Queue enqueue targets (canonical path). Default ZOHO. */
export function crmSyncEnqueueTargets(
  env: Record<string, string | undefined> = process.env,
): Array<"ZOHO" | "SALESFORCE"> {
  const raw = env.CRM_SYNC_TARGETS ?? process.env.CRM_SYNC_TARGETS ?? "ZOHO";
  const parts = raw
    .split(",")
    .map((s) => s.trim().toUpperCase())
    .filter((s): s is "ZOHO" | "SALESFORCE" => s === "ZOHO" || s === "SALESFORCE");
  return parts.length ? [...new Set(parts)] : ["ZOHO"];
}
