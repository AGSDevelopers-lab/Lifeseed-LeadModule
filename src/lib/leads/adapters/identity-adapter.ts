import type { UserRole } from "@prisma/client";

import type { IdentityPort } from "../domain/ports/IdentityPort";
import type { ActorContext } from "../domain/ports/shared";
import {
  getSession,
  permissionGranted,
  permissionsForRoles,
  type Permission,
} from "@/lib/rbac";

/**
 * Resolves the current portal session into Lead {@link ActorContext}
 * (userId, roles, siteId). Assignment rows stay on the session object
 * for future IAM-backed AssignmentDirectory (B13).
 */
export class SessionIdentityAdapter implements IdentityPort {
  async current(): Promise<ActorContext | null> {
    return resolveLeadActor();
  }

  hasPermission(ctx: ActorContext, permission: string): boolean {
    const held = permissionsForRoles(ctx.roles as UserRole[]);
    return permissionGranted(held, permission as Permission);
  }
}

export async function resolveLeadActor(): Promise<ActorContext | null> {
  const session = await getSession();
  if (!session) return null;
  return {
    userId: session.userId,
    roles: session.roles,
    siteId: session.siteId,
  };
}

export const sessionIdentityAdapter = new SessionIdentityAdapter();
