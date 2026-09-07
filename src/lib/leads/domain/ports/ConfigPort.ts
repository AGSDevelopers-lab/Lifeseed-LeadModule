import type { LeadConfig } from "../entities/LeadConfig";

export interface ConfigPort {
  /** Point-in-time payload (defaults to now). */
  getActive<T = Record<string, unknown>>(key: string, at?: Date): Promise<T | null>;
  /** Active payload, or a specific version when `version` is set. */
  read<T = Record<string, unknown>>(key: string, version?: number): Promise<T | null>;
  currentVersion(key: string): Promise<number | null>;
  history(key: string): Promise<LeadConfig[]>;
}
