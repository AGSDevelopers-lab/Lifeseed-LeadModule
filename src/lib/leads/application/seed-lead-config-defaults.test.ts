import { describe, expect, it } from "vitest";

import { seedLeadConfigDefaults } from "./seed-lead-config-defaults";
import { CONFIG_KEY_LIST } from "../config/keys";

function seedDb() {
  const users = [
    { id: "sys-admin" },
    { id: "ops-admin" },
  ];
  const configs: Array<{ key: string; version: number }> = [];
  return {
    user: {
      findFirst: async (args: { where?: { id?: { not?: string } } }) => {
        const notId = args.where?.id?.not;
        return users.find((u) => u.id !== notId) ?? null;
      },
      findMany: async () => users,
    },
    leadConfig: {
      findUnique: async (args: { where: { key_version: { key: string; version: number } } }) => {
        const hit = configs.find(
          (c) =>
            c.key === args.where.key_version.key && c.version === args.where.key_version.version,
        );
        return hit ? { id: `${hit.key}-v${hit.version}` } : null;
      },
      create: async (args: { data: { key: string; version: number } }) => {
        configs.push({ key: args.data.key, version: args.data.version });
        return args.data;
      },
    },
    _configs: configs,
  };
}

describe("seedLeadConfigDefaults", () => {
  it("is idempotent — second run inserts nothing", async () => {
    const db = seedDb();
    const first = await seedLeadConfigDefaults(db, {
      LEAD_SYSTEM_USER_ID: "sys-admin",
      LEAD_CONFIG_APPROVER_USER_ID: "ops-admin",
    });
    const second = await seedLeadConfigDefaults(db, {
      LEAD_SYSTEM_USER_ID: "sys-admin",
      LEAD_CONFIG_APPROVER_USER_ID: "ops-admin",
    });
    expect(first.inserted).toBe(CONFIG_KEY_LIST.length);
    expect(second.inserted).toBe(0);
    expect(second.skipped).toBe(CONFIG_KEY_LIST.length);
    expect(db._configs).toHaveLength(CONFIG_KEY_LIST.length);
  });
});
