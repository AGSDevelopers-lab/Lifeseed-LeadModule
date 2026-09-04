import path from "node:path";
import { fileURLToPath } from "node:url";

import { Linter } from "eslint";
import { describe, expect, it } from "vitest";

const filename = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "../domain/layering-probe.ts",
);

describe("ESLint layering guard", () => {
  it("rejects @prisma/client imports inside domain", () => {
    const linter = new Linter();
    const messages = linter.verify(
      `import { PrismaClient } from "@prisma/client";\nexport const x = PrismaClient;\n`,
      {
        files: ["**/*.ts"],
        languageOptions: { parserOptions: { ecmaVersion: 2022, sourceType: "module" } },
        rules: {
          "no-restricted-imports": [
            "error",
            {
              paths: [
                {
                  name: "@prisma/client",
                  message: "Lead domain must stay framework-free (no Prisma).",
                },
              ],
            },
          ],
        },
      },
      { filename },
    );
    expect(messages.some((m) => m.ruleId === "no-restricted-imports")).toBe(true);
  });
});
