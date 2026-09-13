import { beforeEach, describe, expect, it, vi } from "vitest";

import { CrmSyncStatus, CrmSyncTarget, LeadEventType } from "@prisma/client";

import { enqueueCrmSyncFromOutbox } from "./consumers/crm-consumer";
import {
  isCrmSyncEnabled,
  isCrmZohoSyncEnabled,
  isCrmSalesforceSyncEnabled,
} from "./feature-flag";
import type { LeadOutboxEvent } from "../domain/entities/LeadOutboxEvent";

describe("B16 CRM flags", () => {
  it("defaults off", () => {
    const env = { CRM_SYNC_ENABLED: undefined, CRM_SYNC_ZOHO_ENABLED: undefined, CRM_SYNC_SALESFORCE_ENABLED: undefined };
    expect(isCrmSyncEnabled(env as NodeJS.ProcessEnv)).toBe(false);
    expect(isCrmZohoSyncEnabled(env as NodeJS.ProcessEnv)).toBe(false);
    expect(isCrmSalesforceSyncEnabled(env as NodeJS.ProcessEnv)).toBe(false);
  });

  it("accepts true and on", () => {
    expect(isCrmSyncEnabled({ CRM_SYNC_ENABLED: "true" } as NodeJS.ProcessEnv)).toBe(true);
    expect(isCrmZohoSyncEnabled({ CRM_SYNC_ZOHO_ENABLED: "on" } as NodeJS.ProcessEnv)).toBe(true);
  });
});

describe("enqueueCrmSyncFromOutbox idempotency", () => {
  const created: unknown[] = [];
  const existing = new Map<string, { id: string }>();

  const db = {
    crmSyncQueue: {
      findFirst: async (args: { where: { outboxEventId: string; syncTarget?: CrmSyncTarget } }) => {
        const key = `${args.where.outboxEventId}:${args.where.syncTarget ?? "ZOHO"}`;
        return existing.get(key) ?? null;
      },
      create: async (args: { data: { outboxEventId?: string; syncTarget?: CrmSyncTarget } }) => {
        const key = `${args.data.outboxEventId}:${args.data.syncTarget ?? "ZOHO"}`;
        existing.set(key, { id: key });
        created.push(args.data);
        return { id: key };
      },
    },
  };

  beforeEach(() => {
    created.length = 0;
    existing.clear();
    process.env.CRM_SYNC_TARGETS = "ZOHO";
  });

  const event: LeadOutboxEvent = {
    id: "outbox-1",
    aggregateType: "Lead",
    aggregateId: "lead-1",
    eventType: LeadEventType.LeadCreated,
    eventVersion: 1,
    payload: { status: "NEW" },
    occurredAt: new Date(),
    enqueuedAt: new Date(),
    publishedAt: null,
    dispatchStatus: "PENDING" as never,
    attemptCount: 0,
    lastAttemptAt: null,
    lastAttemptError: null,
    lockedUntil: null,
    lockedByWorkerId: null,
  };

  it("creates one queue row then no-ops on the same outboxEventId", async () => {
    await enqueueCrmSyncFromOutbox(event, db);
    await enqueueCrmSyncFromOutbox(event, db);
    expect(created).toHaveLength(1);
  });
});

describe("ZohoCrmAdapter HTTP (mocked fetch + prisma)", () => {
  it("captures external id after upsert", async () => {
    const rows = new Map<string, { id: string; payload: object; externalId: string | null; status: string }>();
    rows.set("job1", {
      id: "job1",
      payload: { fullName: "Ada", email: "a@b.c" },
      externalId: null,
      status: CrmSyncStatus.PENDING,
    });
    vi.resetModules();
    vi.doMock("@/lib/db", () => ({
      prisma: {
        crmSyncQueue: {
          findUnique: async ({ where }: { where: { id: string } }) => rows.get(where.id) ?? null,
          update: async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => {
            const cur = rows.get(where.id)!;
            const next = { ...cur, ...data, externalId: (data.externalId as string) ?? cur.externalId };
            rows.set(where.id, next);
            return next;
          },
        },
      },
    }));
    process.env.ZOHO_CLIENT_ID = "id";
    process.env.ZOHO_CLIENT_SECRET = "secret";
    process.env.ZOHO_REFRESH_TOKEN = "rt";
    const fetchMock = vi.fn(async (url: string) => {
      if (String(url).includes("/oauth/v2/token")) {
        return { ok: true, json: async () => ({ access_token: "tok" }) };
      }
      return { ok: true, json: async () => ({ data: [{ details: { id: "z-99" } }] }) };
    });
    vi.stubGlobal("fetch", fetchMock);
    const { ZohoCrmAdapter } = await import("../adapters/crm/zoho-adapter");
    await new ZohoCrmAdapter().sync("job1");
    expect(rows.get("job1")?.externalId).toBe("z-99");
    vi.unstubAllGlobals();
  });
});
