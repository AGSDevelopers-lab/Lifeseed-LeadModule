import { UserRole } from "@prisma/client";

import { CONFIG_OWNER_ROLE, type ConfigKey } from "@/lib/leads/config/keys";

export function canMutateConfigKey(roles: UserRole[], key: ConfigKey): boolean {
  if (roles.includes(UserRole.BANK_SUPER_ADMIN)) return true;
  return roles.includes(CONFIG_OWNER_ROLE[key]);
}
