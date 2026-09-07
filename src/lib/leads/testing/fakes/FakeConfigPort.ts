import type { LeadConfig } from "../../domain/entities/LeadConfig";
import type { ConfigPort } from "../../domain/ports/ConfigPort";

type Versioned = { payload: Record<string, unknown>; version: number; entity: LeadConfig };

function entity(partial: Partial<LeadConfig> & Pick<LeadConfig, "key" | "payload">): LeadConfig {
  return {
    id: partial.id ?? `cfg-${partial.key}-${partial.version ?? 1}`,
    version: partial.version ?? 1,
    payloadSchemaRef: partial.payloadSchemaRef ?? `${partial.key}@1`,
    ownerRole: partial.ownerRole ?? "BANK_SUPER_ADMIN",
    createdByUserId: partial.createdByUserId ?? "sys",
    createdAt: partial.createdAt ?? new Date("2026-01-01T00:00:00.000Z"),
    approvedByUserId: partial.approvedByUserId ?? "approver",
    approvedAt: partial.approvedAt ?? new Date("2026-01-01T00:00:00.000Z"),
    effectiveFrom: partial.effectiveFrom ?? new Date("2026-01-01T00:00:00.000Z"),
    effectiveUntil: partial.effectiveUntil ?? null,
    isActive: partial.isActive ?? true,
    notes: partial.notes ?? null,
    key: partial.key,
    payload: partial.payload,
  };
}

export class FakeConfigPort implements ConfigPort {
  private readonly versions = new Map<string, Versioned[]>();

  seed(key: string, payload: Record<string, unknown>, version = 1): void {
    const row = entity({ key, payload, version, isActive: true });
    const list = this.versions.get(key) ?? [];
    for (const existing of list) existing.entity.isActive = false;
    list.push({ payload, version, entity: row });
    this.versions.set(key, list);
  }

  async getActive<T = Record<string, unknown>>(key: string, at?: Date): Promise<T | null> {
    const list = this.versions.get(key) ?? [];
    const t = at ?? new Date();
    const hit = [...list]
      .filter((v) => {
        const from = v.entity.effectiveFrom ?? v.entity.createdAt;
        const until = v.entity.effectiveUntil;
        return from.getTime() <= t.getTime() && (until == null || until.getTime() > t.getTime());
      })
      .sort((a, b) => b.version - a.version)[0];
    return (hit?.payload as T | undefined) ?? null;
  }

  async read<T = Record<string, unknown>>(key: string, version?: number): Promise<T | null> {
    const list = this.versions.get(key) ?? [];
    if (version != null) {
      const hit = list.find((v) => v.version === version);
      return (hit?.payload as T | undefined) ?? null;
    }
    const active = list.find((v) => v.entity.isActive) ?? list[list.length - 1];
    return (active?.payload as T | undefined) ?? null;
  }

  async currentVersion(key: string): Promise<number | null> {
    const list = this.versions.get(key) ?? [];
    const active = list.find((v) => v.entity.isActive);
    return active?.version ?? null;
  }

  async history(key: string): Promise<LeadConfig[]> {
    return [...(this.versions.get(key) ?? [])]
      .sort((a, b) => b.version - a.version)
      .map((v) => v.entity);
  }
}
