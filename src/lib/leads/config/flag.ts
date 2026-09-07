export type LeadConfigMode = "off" | "partial" | "on";

/**
 * Default `off` in production (hard-coded constants).
 * Default `partial` in non-production (ConfigPort with defaults fallback).
 */
export function getLeadConfigMode(env: NodeJS.ProcessEnv = process.env): LeadConfigMode {
  const raw = env.LEAD_CONFIG_ENABLED;
  if (raw === "off" || raw === "partial" || raw === "on") return raw;
  if (env.VERCEL_ENV === "production" || env.NODE_ENV === "production") {
    return "off";
  }
  return "partial";
}
