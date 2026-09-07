import { LRUCache } from "lru-cache";

import type { LeadConfig } from "../domain/entities/LeadConfig";
import { LeadConfigVersionMismatchError } from "../domain/errors";
import type { ConfigPort } from "../domain/ports/ConfigPort";
import { configToDomain, type PrismaConfigRow } from "./mappers/config-mapper";

const TTL_MS = 5 * 60 * 1000;

export type ConfigStoreDb = {
  leadConfig: {
    findFirst: (args?: object) => Promise<PrismaConfigRow | null>;
    findMany: (args: object) => Promise<PrismaConfigRow[]>;
    findUnique: (args: object) => Promise<PrismaConfigRow | null>;
  };
};

type CacheValue = { payload: Record<string, unknown>; version: number };

export class ConfigStoreAdapter implements ConfigPort {
  private readonly cache: LRUCache<string, CacheValue>;
  private readonly db: ConfigStoreDb;

  constructor(
    db: object,
    cache?: LRUCache<string, CacheValue>,
  ) {
    this.db = db as ConfigStoreDb;
    this.cache =
      cache ??
      new LRUCache<string, CacheValue>({
        max: 50,
        ttl: TTL_MS,
      });
  }

  invalidate(key: string): void {
    this.cache.delete(`active:${key}`);
    for (const cacheKey of [...this.cache.keys()]) {
      if (cacheKey.startsWith(`ver:${key}:`) || cacheKey.startsWith(`at:${key}:`)) {
        this.cache.delete(cacheKey);
      }
    }
  }

  async getActive<T = Record<string, unknown>>(key: string, at?: Date): Promise<T | null> {
    if (!at) {
      return this.read<T>(key);
    }
    const cacheKey = `at:${key}:${at.toISOString()}`;
    const cached = this.cache.get(cacheKey);
    if (cached) return cached.payload as T;
    const row = await this.db.leadConfig.findFirst({
      where: {
        key,
        approvedAt: { not: null },
        OR: [{ effectiveFrom: null }, { effectiveFrom: { lte: at } }],
        AND: [{ OR: [{ effectiveUntil: null }, { effectiveUntil: { gt: at } }] }],
      },
      orderBy: { version: "desc" },
    });
    if (!row) {
      throw new LeadConfigVersionMismatchError("No config version active at requested time", {
        key,
        at: at.toISOString(),
      });
    }
    const payload = asRecord(row.payload);
    this.cache.set(cacheKey, { payload, version: row.version });
    return payload as T;
  }

  async read<T = Record<string, unknown>>(key: string, version?: number): Promise<T | null> {
    if (version != null) {
      const cacheKey = `ver:${key}:${version}`;
      const cached = this.cache.get(cacheKey);
      if (cached) return cached.payload as T;
      const row = await this.db.leadConfig.findUnique({
        where: { key_version: { key, version } },
      });
      if (!row) return null;
      const payload = asRecord(row.payload);
      this.cache.set(cacheKey, { payload, version });
      return payload as T;
    }
    const cacheKey = `active:${key}`;
    const cached = this.cache.get(cacheKey);
    if (cached) return cached.payload as T;
    const row = await this.db.leadConfig.findFirst({
      where: { key, isActive: true },
      orderBy: { version: "desc" },
    });
    if (!row) return null;
    const payload = asRecord(row.payload);
    this.cache.set(cacheKey, { payload, version: row.version });
    return payload as T;
  }

  async currentVersion(key: string): Promise<number | null> {
    const row = await this.db.leadConfig.findFirst({
      where: { key, isActive: true },
      orderBy: { version: "desc" },
    });
    return row?.version ?? null;
  }

  async history(key: string): Promise<LeadConfig[]> {
    const rows = await this.db.leadConfig.findMany({
      where: { key },
      orderBy: { version: "desc" },
    });
    return rows.map(configToDomain);
  }
}

function asRecord(payload: unknown): Record<string, unknown> {
  if (payload && typeof payload === "object" && !Array.isArray(payload)) {
    return payload as Record<string, unknown>;
  }
  return {};
}

let singleton: ConfigStoreAdapter | null = null;

export function getConfigStoreAdapter(db: object): ConfigStoreAdapter {
  if (!singleton) singleton = new ConfigStoreAdapter(db);
  return singleton;
}

export function resetConfigStoreAdapterForTests(): void {
  singleton = null;
}
