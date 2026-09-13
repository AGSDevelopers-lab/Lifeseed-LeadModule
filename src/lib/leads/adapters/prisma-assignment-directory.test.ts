import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/db", () => ({ prisma: {} }));

import { PrismaAssignmentDirectory } from "./prisma-assignment-directory";

describe("PrismaAssignmentDirectory fallback fields", () => {
  it("returns only existing user/site/open-count fields and empty languages/skills", async () => {
    const dir = new PrismaAssignmentDirectory(
      {
        user: {
          findMany: async () => [{ id: "u1", siteId: "s1" }],
          findUnique: async () => ({ siteId: "s1", isActive: true }),
        },
      } as never,
      async () => 4,
      ["ASSIGNED"] as never,
    );
    const rows = await dir.listAvailableTelecallers("s1");
    expect(rows).toEqual([
      {
        userId: "u1",
        siteId: "s1",
        openLeadCount: 4,
        languages: [],
        skills: [],
      },
    ]);
  });
});
