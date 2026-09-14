import { permissionGranted, permissionsForRoles } from "@/lib/rbac-permissions";
import type { UserRole } from "@prisma/client";

/** Same gate as admin/leads/analytics/page.tsx. */
export function canViewLeadAnalytics(session: { roles: UserRole[] }): boolean {
  const held = permissionsForRoles(session.roles);
  return (
    permissionGranted(held, "marketing.analytics") ||
    permissionGranted(held, "lead.list")
  );
}
