"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

import { useRoleContext } from "@/components/auth/role-provider";
import { Button } from "@/components/ui/primitives";
import { createClient } from "@/lib/supabase/client";
import { portalForRole, type PortalKind } from "@/lib/rbac-permissions";
import { cn } from "@/lib/utils";

const NAV: Record<PortalKind, Array<{ href: string; label: string }>> = {
  admin: [
    { href: "/admin", label: "Dashboard" },
    { href: "/admin/users", label: "Users" },
  ],
  clinic: [{ href: "/clinic", label: "Dashboard" }],
  donor: [{ href: "/donor", label: "Dashboard" }],
  recipient: [{ href: "/recipient", label: "Dashboard" }],
};

export function PortalShell({ children }: { children: React.ReactNode }) {
  const { email, roles } = useRoleContext();
  const pathname = usePathname();
  const router = useRouter();

  const primaryPortal = roles.length
    ? portalForRole(roles[0])
    : ("admin" as PortalKind);

  // Prefer nav matching current path prefix
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
          <div className="text-sm text-stone-500 capitalize">{activePortal}</div>
        </div>
        <nav className="flex flex-col gap-1">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={cn(
                "rounded-md px-3 py-2 text-sm text-stone-700 hover:bg-stone-100",
                pathname === link.href && "bg-emerald-50 font-medium text-emerald-900",
              )}
            >
              {link.label}
            </Link>
          ))}
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
          <div className="text-sm text-stone-600 truncate">{email}</div>
          <Button variant="outline" onClick={logout}>
            Log out
          </Button>
        </header>
        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  );
}
