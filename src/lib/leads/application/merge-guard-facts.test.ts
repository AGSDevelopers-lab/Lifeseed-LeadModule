import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), ".");

describe("B14 mergeLoserStub facts", () => {
  it("does not hardcode leadMergeExists: true in commands.ts", () => {
    const src = readFileSync(path.join(root, "commands.ts"), "utf8");
    expect(src).not.toMatch(/leadMergeExists:\s*true/);
    expect(src).toMatch(/leadMerge\.findUnique/);
  });
});
