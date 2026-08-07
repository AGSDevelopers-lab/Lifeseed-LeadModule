import { UserRole } from "@prisma/client";
import { NextResponse } from "next/server";

import { prisma } from "@/lib/db";
import {
  permissionGranted,
  permissionsForRoles,
  type Permission,
} from "@/lib/rbac-permissions";
import { createClient } from "@/lib/supabase/server";

export type {
  Permission,
  PortalKind,
  Role,
} from "@/lib/rbac-permissions";

export {
  ROLE_PERMISSIONS,
  permissionGranted,
  permissionsForRoles,
  portalForRole,
  portalHome,
  portalsForRoles,
} from "@/lib/rbac-permissions";

export class UnauthorizedError extends Error {
  constructor(message = "Unauthorized") {
    super(message);
    this.name = "UnauthorizedError";
  }
}

export class ForbiddenError extends Error {
  constructor(public readonly permission: Permission) {
    super(`Forbidden: missing permission ${permission}`);
    this.name = "ForbiddenError";
  }
}

export type SessionUser = {
  userId: string;
  email: string;
  roles: UserRole[];
  siteId: string | null;
  clinicId: string | null;
  assignments: Array<{
    role: UserRole;
    scopeType: string | null;
    scopeId: string | null;
  }>;
};

/**
 * Resolve LifeSeed User + roles from Supabase Auth session cookies.
 * Matches public."User" by auth user id first, then by email (seed-era link).
 */
export async function getSession(): Promise<SessionUser | null> {
  const supabase = await createClient();
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();

  if (!authUser?.email) return null;

  const dbUser =
    (await prisma.user.findUnique({
      where: { id: authUser.id },
      include: { roles: true },
    })) ??
    (await prisma.user.findUnique({
      where: { email: authUser.email },
      include: { roles: true },
    }));

  if (!dbUser || !dbUser.isActive) return null;

  return {
    userId: dbUser.id,
    email: dbUser.email,
    roles: dbUser.roles.map((r) => r.role),
    siteId: dbUser.siteId,
    clinicId: dbUser.clinicId,
    assignments: dbUser.roles.map((r) => ({
      role: r.role,
      scopeType: r.scopeType,
      scopeId: r.scopeId,
    })),
  };
}

/**
 * Call at the top of every API route / server page that needs a permission.
 * Throws a Response (401 / 403) when unauthorized.
 */
export async function requirePermission(
  perm: Permission,
): Promise<SessionUser> {
  const session = await getSession();
  if (!session) {
    throw NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const held = new Set(permissionsForRoles(session.roles));
  if (!permissionGranted(held, perm)) {
    throw NextResponse.json(
      { error: "Forbidden", permission: perm },
      { status: 403 },
    );
  }

  return session;
}
