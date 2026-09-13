import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/audit", () => ({
  audit: { log: vi.fn(async () => undefined) },
}));

import {
  approveNotificationTemplate,
  proposeNotificationTemplate,
  TemplateSodViolationError,
} from "./notification-templates";
import { B12_TEMPLATE_KEYS, seedB12NotificationTemplateStructure } from "./seed-notification-templates";

describe("B12 templates", () => {
  it("seeds five keys × three channels inactive", async () => {
    const created: object[] = [];
    const db = {
      notificationTemplate: {
        findFirst: vi.fn(async () => null),
        create: vi.fn(async ({ data }: { data: object }) => {
          created.push(data);
          return { id: `id-${created.length}` };
        }),
      },
    };
    const result = await seedB12NotificationTemplateStructure(db);
    expect(result.inserted).toBe(B12_TEMPLATE_KEYS.length * 3);
    expect(created.every((row) => (row as { isActive: boolean }).isActive === false)).toBe(true);
    expect(created.every((row) => (row as { body: string }).body === "{{body}}")).toBe(true);
    expect(created.every((row) => (row as { approvedByUserId: null }).approvedByUserId === null)).toBe(
      true,
    );
  });

  it("enforces propose/approve SoD via audit actor", async () => {
    const db = {
      notificationTemplate: {
        findMany: vi.fn(),
        findFirst: vi.fn(async () => null),
        findUnique: vi.fn(async () => ({
          id: "t1",
          key: "lead.intake.welcome",
          channel: "EMAIL",
          language: "ENGLISH",
        })),
        create: vi.fn(async () => ({ id: "t1", version: 1 })),
        update: vi.fn(async () => ({ id: "t1", isActive: true, approvedByUserId: "u2" })),
        updateMany: vi.fn(async () => ({ count: 0 })),
      },
      notificationDeliveryLog: { findMany: vi.fn(), updateMany: vi.fn() },
      auditLog: {
        findFirst: vi.fn(async () => ({ actorUserId: "u1" })),
      },
    };
    await expect(
      approveNotificationTemplate(db, { id: "t1", actorUserId: "u1" }),
    ).rejects.toBeInstanceOf(TemplateSodViolationError);
    const ok = await approveNotificationTemplate(db, { id: "t1", actorUserId: "u2" });
    expect(ok.isActive).toBe(true);
  });

  it("propose increments version", async () => {
    const db = {
      notificationTemplate: {
        findMany: vi.fn(),
        findFirst: vi.fn(async () => ({ version: 2 })),
        findUnique: vi.fn(),
        create: vi.fn(async ({ data }: { data: { version: number } }) => ({
          id: "n",
          version: data.version,
        })),
        update: vi.fn(),
        updateMany: vi.fn(),
      },
      notificationDeliveryLog: { findMany: vi.fn(), updateMany: vi.fn() },
      auditLog: { findFirst: vi.fn() },
    };
    const row = await proposeNotificationTemplate(db, {
      key: "lead.intake.welcome",
      channel: "EMAIL",
      provider: "RESEND",
      body: "{{body}}",
      variables: ["body"],
      language: "ENGLISH",
      actorUserId: "u1",
    });
    expect(row.version).toBe(3);
  });
});
