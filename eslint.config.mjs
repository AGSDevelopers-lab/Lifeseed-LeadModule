import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    files: ["src/lib/leads/domain/**/*.ts"],
    rules: {
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
    },
  },
  {
    files: ["src/lib/leads/application/**/*.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "react",
              message: "Lead application must not import UI.",
            },
            {
              name: "react-dom",
              message: "Lead application must not import UI.",
            },
          ],
          patterns: [
            {
              group: ["react/*", "react-dom/*", "next/link", "next/navigation", "next/image"],
              message: "Lead application must not import UI.",
            },
          ],
        },
      ],
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
