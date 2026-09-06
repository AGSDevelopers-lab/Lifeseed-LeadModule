import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

describe("Prisma outbox claim SQL", () => {
  it("uses FOR UPDATE SKIP LOCKED and bumped interactive tx timeouts", () => {
    const src = readFileSync(
      path.join(path.dirname(fileURLToPath(import.meta.url)), "prisma-outbox.ts"),
      "utf8",
    );
    expect(src).toContain("FOR UPDATE OF e SKIP LOCKED");
    expect(src).toContain("LEAD_INTERACTIVE_TX_OPTIONS");
    expect(src).toContain('DISTINCT ON ("aggregateId")');
  });
});
