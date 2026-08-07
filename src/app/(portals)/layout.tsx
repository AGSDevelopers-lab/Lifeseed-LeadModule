import { redirect } from "next/navigation";

import { RoleProvider } from "@/components/auth/role-provider";
import { PortalShell } from "@/components/auth/portal-shell";
import { getSession } from "@/lib/rbac";

export default async function PortalsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();
  if (!session) redirect("/login");

  return (
    <RoleProvider
      userId={session.userId}
      email={session.email}
      roles={session.roles}
    >
      <PortalShell>{children}</PortalShell>
    </RoleProvider>
  );
}
