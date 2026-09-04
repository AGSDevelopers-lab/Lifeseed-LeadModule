import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const root = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/lib/leads/**/*.test.ts"],
    exclude: ["node_modules", ".next"],
  },
  resolve: {
    alias: {
      "@/leads/domain": path.join(root, "src/lib/leads/domain"),
      "@/leads/testing": path.join(root, "src/lib/leads/testing"),
      "@": path.join(root, "src"),
    },
  },
});
