"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LayoutDashboard, LogOut, Users, UserRound } from "lucide-react";

import { useRoleContext } from "@/components/auth/role-provider";
import { Button } from "@/components/ui/primitives";
import { createClient } from "@/lib/supabase/client";
import { portalForRole, type PortalKind } from "@/lib/rbac-permissions";
import { cn } from "@/lib/utils";

const NAV: Record<
  PortalKind,
  Array<{ href: string; label: string; icon?: "dash" | "users" | "donors" }>
> = {
  admin: [
    { href: "/admin", label: "Dashboard", icon: "dash" },
    { href: "/admin/users", label: "Users", icon: "users" },
    { href: "/admin/donors", label: "Donors", icon: "donors" },
  ],
  clinic: [{ href: "/clinic", label: "Dashboard", icon: "dash" }],
  donor: [{ href: "/donor", label: "Dashboard", icon: "dash" }],
  recipient: [{ href: "/recipient", label: "Dashboard", icon: "dash" }],
};

function NavIcon({ kind }: { kind?: "dash" | "users" | "donors" }) {
  const className = "h-4 w-4 shrink-0 opacity-70";
  if (kind === "users") return <Users className={className} />;
  if (kind === "donors") return <UserRound className={className} />;
  return <LayoutDashboard className={className} />;
}

export function PortalShell({ children }: { children: React.ReactNode }) {
  const { email, roles } = useRoleContext();
  const pathname = usePathname();
  const router = useRouter();

  const primaryPortal = roles.length
    ? portalForRole(roles[0])
    : ("admin" as PortalKind);

  const activePortal: PortalKind =
    (["admin", "clinic", "donor", "recipient"] as PortalKind[]).find((p) =>
      pathname.startsWith(`/${p}`),
    ) ?? primaryPortal;

  const links = NAV[activePortal];

  async function logout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <div className="flex min-h-screen bg-stone-50">
      <aside className="hidden w-56 shrink-0 border-r border-stone-200 bg-white p-4 md:block">
        <div className="mb-6">
          <div className="text-xs font-semibold uppercase tracking-wide text-emerald-800">
            LifeSeed
          </div>
          <div className="text-sm capitalize text-stone-500">{activePortal}</div>
        </div>
        <nav className="flex flex-col gap-1">
          {links.map((link) => {
            const active =
              pathname === link.href || pathname.startsWith(`${link.href}/`);
            return (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  "flex items-center gap-2 rounded-md px-3 py-2 text-sm text-stone-700 hover:bg-stone-100",
                  active && "bg-emerald-50 font-medium text-emerald-900",
                )}
              >
                <NavIcon kind={link.icon} />
                {link.label}
              </Link>
            );
          })}
          <Link
            href="/portal"
            className="mt-4 rounded-md px-3 py-2 text-sm text-stone-500 hover:bg-stone-100"
          >
            Switch portal
          </Link>
        </nav>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 items-center justify-between border-b border-stone-200 bg-white px-4">
          <div className="truncate text-sm text-stone-600">{email}</div>
          <Button variant="outline" onClick={logout}>
            <LogOut className="h-4 w-4" />
            Log out
          </Button>
        </header>
        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  );
}
