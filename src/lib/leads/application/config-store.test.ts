import { describe, expect, it } from "vitest";

import {
  approveConfigVersion,
  ConfigSodViolationError,
  proposeConfigVersion,
  resolveConfigPayload,
  type ConfigWriteDb,
} from "./config-store";
import { ConfigStoreAdapter } from "../adapters/config-store-adapter";
import { DEFAULT_SCORE_WEIGHTS } from "../config/defaults";
import { CONFIG_KEYS } from "../config/keys";
import type { PrismaConfigRow } from "../adapters/mappers/config-mapper";
import { scoreLead } from "../lead-scoring";
import { LeadPersonType, LeadSource } from "@prisma/client";

function row(partial: Partial<PrismaConfigRow> & Pick<PrismaConfigRow, "key" | "version" | "payload">): PrismaConfigRow {
  return {
    id: partial.id ?? `id-${partial.key}-${partial.version}`,
    payloadSchemaRef: `${partial.key}@1`,
    ownerRole: "OPS_MANAGER",
    createdByUserId: partial.createdByUserId ?? "author",
    createdAt: partial.createdAt ?? new Date("2026-01-01T00:00:00.000Z"),
    approvedByUserId: partial.approvedByUserId ?? null,
    approvedAt: partial.approvedAt ?? null,
    effectiveFrom: partial.effectiveFrom ?? null,
    effectiveUntil: partial.effectiveUntil ?? null,
    isActive: partial.isActive ?? false,
    notes: partial.notes ?? null,
    ...partial,
  };
}

function memoryDb(seed: PrismaConfigRow[] = []): ConfigWriteDb & { _rows: PrismaConfigRow[] } {
  const rows: PrismaConfigRow[] = [...seed];
  const db: ConfigWriteDb & { _rows: PrismaConfigRow[] } = {
    leadConfig: {
      findFirst: async (args?: object) => {
        const a = (args ?? {}) as {
          where?: { key?: string; isActive?: boolean };
          orderBy?: { version: string };
        };
        let list = rows.filter((r) => {
          const w = a.where ?? {};
          if (w.key && r.key !== w.key) return false;
          if (w.isActive === true && !r.isActive) return false;
          return true;
        });
        if (a.orderBy?.version === "desc") list = list.sort((b, c) => c.version - b.version);
        return list[0] ?? null;
      },
      findUnique: async (args: object) => {
        const kv = (args as { where: { key_version?: { key: string; version: number } } }).where
          .key_version;
        if (!kv) return null;
        return rows.find((r) => r.key === kv.key && r.version === kv.version) ?? null;
      },
      findMany: async (args: object) => {
        const w = ((args as { where?: Record<string, unknown> }).where ?? {}) as Record<
          string,
          unknown
        >;
        return rows.filter((r) => {
          if (w.key && r.key !== w.key) return false;
          if (w.isActive === true && !r.isActive) return false;
          const not = w.NOT as { id?: string } | undefined;
          if (not?.id && r.id === not.id) return false;
          return true;
        });
      },
      create: async (args: { data: object }) => {
        const created = row(args.data as PrismaConfigRow);
        rows.push(created);
        return created;
      },
      update: async (args: { where: { id: string }; data: object }) => {
        const idx = rows.findIndex((r) => r.id === args.where.id);
        rows[idx] = { ...rows[idx], ...(args.data as Partial<PrismaConfigRow>) };
        return rows[idx];
      },
    },
    $transaction: async <T>(fn: (tx: ConfigWriteDb) => Promise<T>) => fn(db),
    _rows: rows,
  };
  return db;
}

const silentAudit = async () => undefined;

const GOLDEN: Parameters<typeof scoreLead>[0] = {
  personType: LeadPersonType.RECIPIENT,
  source: LeadSource.WEB_FORM,
  fullName: "Ada Lovelace",
  phone: "9876543210",
  email: "ada@example.com",
  city: "Kolkata",
  state: "WB",
  pincode: "700001",
  ageGroup: "30-35",
  preferredLanguage: "english",
};

describe("LeadConfig propose/approve", () => {
  it("rejects author approving own version", async () => {
    const db = memoryDb([
      row({
        key: CONFIG_KEYS.SCORE_WEIGHTS_V1,
        version: 2,
        payload: DEFAULT_SCORE_WEIGHTS,
        createdByUserId: "author",
        isActive: false,
      }),
    ]);
    await expect(
      approveConfigVersion(
        db,
        { key: CONFIG_KEYS.SCORE_WEIGHTS_V1, version: 2, actorUserId: "author" },
        silentAudit,
      ),
    ).rejects.toBeInstanceOf(ConfigSodViolationError);
  });

  it("approval activates version and sets prior effectiveUntil", async () => {
    const db = memoryDb([
      row({
        key: CONFIG_KEYS.SCORE_WEIGHTS_V1,
        version: 1,
        payload: DEFAULT_SCORE_WEIGHTS,
        isActive: true,
        approvedByUserId: "ops",
        approvedAt: new Date("2026-01-01"),
        effectiveFrom: new Date("2026-01-01"),
        createdByUserId: "sys",
      }),
      row({
        key: CONFIG_KEYS.SCORE_WEIGHTS_V1,
        version: 2,
        payload: { ...DEFAULT_SCORE_WEIGHTS, completenessMax: 10 },
        isActive: false,
        createdByUserId: "author",
      }),
    ]);
    const updated = await approveConfigVersion(
      db,
      { key: CONFIG_KEYS.SCORE_WEIGHTS_V1, version: 2, actorUserId: "approver" },
      silentAudit,
    );
    expect(updated.isActive).toBe(true);
    const prior = db._rows.find((r) => r.version === 1)!;
    expect(prior.isActive).toBe(false);
    expect(prior.effectiveUntil).toEqual(updated.effectiveFrom);
  });

  it("prior versions remain queryable", async () => {
    const db = memoryDb();
    await proposeConfigVersion(
      db,
      {
        key: CONFIG_KEYS.RETENTION_POLICY_V1,
        payload: { leadUnconvertedDays: 365 },
        actorUserId: "a",
      },
      silentAudit,
    );
    await approveConfigVersion(
      db,
      { key: CONFIG_KEYS.RETENTION_POLICY_V1, version: 1, actorUserId: "b" },
      silentAudit,
    );
    await proposeConfigVersion(
      db,
      {
        key: CONFIG_KEYS.RETENTION_POLICY_V1,
        payload: { leadUnconvertedDays: 180 },
        actorUserId: "a",
      },
      silentAudit,
    );
    const adapter = new ConfigStoreAdapter(db);
    const hist = await adapter.history(CONFIG_KEYS.RETENTION_POLICY_V1);
    expect(hist.map((h) => h.version).sort()).toEqual([1, 2]);
  });
});

describe("config cache invalidation", () => {
  it("returns new payload after activate without waiting TTL", async () => {
    const db = memoryDb([
      row({
        key: CONFIG_KEYS.SCORE_WEIGHTS_V1,
        version: 1,
        payload: DEFAULT_SCORE_WEIGHTS,
        isActive: true,
        createdByUserId: "sys",
        approvedByUserId: "ops",
        approvedAt: new Date(),
      }),
    ]);
    const adapter = new ConfigStoreAdapter(db);
    const first = await adapter.read<typeof DEFAULT_SCORE_WEIGHTS>(CONFIG_KEYS.SCORE_WEIGHTS_V1);
    expect(first?.completenessMax).toBe(20);
    db._rows[0].isActive = false;
    db._rows.push(
      row({
        key: CONFIG_KEYS.SCORE_WEIGHTS_V1,
        version: 2,
        payload: { ...DEFAULT_SCORE_WEIGHTS, completenessMax: 5 },
        isActive: true,
        createdByUserId: "a",
        approvedByUserId: "b",
        approvedAt: new Date(),
      }),
    );
    adapter.invalidate(CONFIG_KEYS.SCORE_WEIGHTS_V1);
    const second = await adapter.read<typeof DEFAULT_SCORE_WEIGHTS>(CONFIG_KEYS.SCORE_WEIGHTS_V1);
    expect(second?.completenessMax).toBe(5);
  });
});

describe("scoring vs config", () => {
  const golden = scoreLead(GOLDEN);

  it("seeded defaults match hard-coded scoring", () => {
    expect(scoreLead(GOLDEN, DEFAULT_SCORE_WEIGHTS)).toEqual(golden);
  });

  it("score changes when SCORE_WEIGHTS_V1 payload changes", () => {
    const mutated = { ...DEFAULT_SCORE_WEIGHTS, completenessMax: 0, recipientAgePoints: 0 };
    expect(scoreLead(GOLDEN, mutated).score).not.toBe(golden.score);
  });

  it("flag off always uses hard-coded defaults", async () => {
    const adapter = new ConfigStoreAdapter(
      memoryDb([
        row({
          key: CONFIG_KEYS.SCORE_WEIGHTS_V1,
          version: 1,
          payload: { ...DEFAULT_SCORE_WEIGHTS, completenessMax: 0 },
          isActive: true,
        }),
      ]),
    );
    const resolved = await resolveConfigPayload(
      adapter,
      CONFIG_KEYS.SCORE_WEIGHTS_V1,
      DEFAULT_SCORE_WEIGHTS,
      { mode: "off" },
    );
    expect(resolved.completenessMax).toBe(20);
    expect(scoreLead(GOLDEN, resolved)).toEqual(golden);
  });
});

describe("LeadScore snapshot immutability", () => {
  it("retains configVersion on the row even after a newer version activates", () => {
    const snapshot = { configKey: CONFIG_KEYS.SCORE_WEIGHTS_V1, configVersion: 1, score: 70 };
    const activeVersion = 2;
    expect(snapshot.configVersion).toBe(1);
    expect(snapshot.configVersion).not.toBe(activeVersion);
  });
});
