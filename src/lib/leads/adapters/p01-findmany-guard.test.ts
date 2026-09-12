import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "../../../..");

function walk(dir: string, acc: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === "node_modules" || entry.name === ".next") continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, acc);
    else if (/\.(ts|tsx)$/.test(entry.name) && !entry.name.includes(".test.")) acc.push(full);
  }
  return acc;
}

describe("P0-1 prisma.lead.findMany boundary", () => {
  it("has zero application-layer prisma.lead.findMany outside adapters/prisma", () => {
    const src = path.join(root, "src");
    const allow = `${path.sep}lib${path.sep}leads${path.sep}adapters${path.sep}`;
    const hits: string[] = [];
    for (const file of walk(src)) {
      if (file.includes(allow)) continue;
      const text = fs.readFileSync(file, "utf8");
      if (text.includes("prisma.lead.findMany")) {
        hits.push(path.relative(src, file));
      }
    }
    expect(hits).toEqual([]);
  });
});
