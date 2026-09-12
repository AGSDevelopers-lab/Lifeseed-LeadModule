import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const root = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/lib/leads/**/*.test.ts"],
    exclude: ["node_modules", ".next"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json-summary", "lcov"],
      reportsDirectory: "./coverage",
      include: ["src/lib/leads/**/*.ts"],
      exclude: ["src/lib/leads/**/*.test.ts", "src/lib/leads/testing/**"],
    },
  },
  resolve: {
    alias: {
      "@/leads/domain": path.join(root, "src/lib/leads/domain"),
      "@/leads/testing": path.join(root, "src/lib/leads/testing"),
      "@": path.join(root, "src"),
    },
  },
});
