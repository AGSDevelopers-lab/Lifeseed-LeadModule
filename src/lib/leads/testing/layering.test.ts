import path from "node:path";
import { fileURLToPath } from "node:url";

import { Linter } from "eslint";
import { describe, expect, it } from "vitest";

const FORBIDDEN_DOMAIN_IMPORT_SNIPPETS: Record<string, string> = {
  prisma: "import { PrismaClient } from '@prisma/client';",
  next: "import { useRouter } from 'next/router';",
  react: "import { useState } from 'react';",
  adapter: "import { someAdapter } from '../adapters/foo';"
};

const filename = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "../domain/layering-probe.ts",
);

const domainRestrictedImports: Linter.RulesRecord = {
  "no-restricted-imports": [
    "error",
    {
      paths: [
        {
          name: "@prisma/client",
          message: "Lead domain must stay framework-free (no Prisma).",
        },
        {
          name: "prisma",
          message: "Lead domain must stay framework-free (no Prisma).",
        },
        {
          name: "next",
          message: "Lead domain must stay framework-free (no Next.js).",
        },
        {
          name: "react",
          message: "Lead domain must stay framework-free (no React).",
        },
      ],
      patterns: [
        {
          group: ["next/*", "react/*", "react-dom", "react-dom/*"],
          message: "Lead domain must stay framework-free.",
        },
        {
          group: ["**/leads/adapters/**", "../adapters/*", "../../adapters/*"],
          message: "Lead domain must not import adapters.",
        },
      ],
    },
  ],
};

function lintAsDomain(code: string) {
  const linter = new Linter();
  return linter.verify(
    code,
    {
      files: ["**/*.ts"],
      languageOptions: { parserOptions: { ecmaVersion: 2022, sourceType: "module" } },
      rules: domainRestrictedImports,
    },
    { filename },
  );
}

describe("ESLint layering guard", () => {
  it.each(Object.entries(FORBIDDEN_DOMAIN_IMPORT_SNIPPETS))(
    "rejects %s import inside domain",
    (_name, snippet) => {
      const messages = lintAsDomain(snippet as string);
      expect(messages.some((m) => m.ruleId === "no-restricted-imports")).toBe(true);
    },
  );
});
