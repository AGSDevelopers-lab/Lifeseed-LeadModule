"use client";

import * as React from "react";
import type { UserRole } from "@prisma/client";

import {
  permissionGranted,
  permissionsForRoles,
  type Permission,
} from "@/lib/rbac-permissions";

type RoleContextValue = {
  userId: string;
  email: string;
  roles: UserRole[];
  permissions: Permission[];
};

const RoleContext = React.createContext<RoleContextValue | null>(null);

export function RoleProvider({
  userId,
  email,
  roles,
  children,
}: {
  userId: string;
  email: string;
  roles: UserRole[];
  children: React.ReactNode;
}) {
  const value = React.useMemo(
    () => ({
      userId,
      email,
      roles,
      permissions: permissionsForRoles(roles),
    }),
    [userId, email, roles],
  );

  return (
    <RoleContext.Provider value={value}>{children}</RoleContext.Provider>
  );
}

export function useRoleContext(): RoleContextValue {
  const ctx = React.useContext(RoleContext);
  if (!ctx) {
    throw new Error("useRoleContext must be used within RoleProvider");
  }
  return ctx;
}

/** Client-side permission check against RoleProvider. */
export function useCan(perm: Permission): boolean {
  const { permissions } = useRoleContext();
  return permissionGranted(permissions, perm);
}
