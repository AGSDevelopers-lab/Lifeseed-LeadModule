"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Activity,
  ClipboardList,
  CreditCard,
  FileText,
  FlaskConical,
  LayoutDashboard,
  LogOut,
  Microscope,
  PieChart,
  Receipt,
  Repeat,
  Settings2,
  Snowflake,
  Truck,
  Users,
  UserRound,
} from "lucide-react";

import { useRoleContext } from "@/components/auth/role-provider";
import { Button } from "@/components/ui/primitives";
import { createClient } from "@/lib/supabase/client";
import { portalForRole, type PortalKind } from "@/lib/rbac-permissions";
import { cn } from "@/lib/utils";

type NavIconKind =
  | "dash"
  | "users"
  | "donors"
  | "samples"
  | "cryo"
  | "config"
  | "drfs"
  | "dispatches"
  | "challans"
  | "invoices"
  | "subscriptions"
  | "payments"
  | "finance"
  | "cycles"
  | "cohorts"
  | "outcomes";

type NavItem = {
  href: string;
  label: string;
  icon?: NavIconKind;
  children?: Array<{ href: string; label: string }>;
};

const NAV: Record<PortalKind, NavItem[]> = {
  admin: [
    { href: "/admin", label: "Dashboard", icon: "dash" },
    { href: "/admin/users", label: "Users", icon: "users" },
    { href: "/admin/donors", label: "Donors", icon: "donors" },
    { href: "/admin/samples", label: "Samples", icon: "samples" },
    { href: "/admin/cryobank", label: "Cryobank", icon: "cryo" },
    { href: "/admin/drfs", label: "DRFs", icon: "drfs" },
    { href: "/admin/dispatches", label: "Dispatches", icon: "dispatches" },
    { href: "/admin/challans", label: "Challans", icon: "challans" },
    { href: "/admin/invoices", label: "Invoices", icon: "invoices" },
    { href: "/admin/subscriptions", label: "Subscriptions", icon: "subscriptions" },
    { href: "/admin/payments", label: "Payments", icon: "payments" },
    {
      href: "/admin/dashboard/finance",
      label: "Finance",
      icon: "finance",
    },
    { href: "/admin/outcomes", label: "Outcomes", icon: "outcomes" },
    {
      href: "/admin/config",
      label: "Config",
      icon: "config",
      children: [
        { href: "/admin/config/qc-gates", label: "QC Gates" },
        { href: "/admin/config/categories", label: "Categories" },
      ],
    },
  ],
  clinic: [
    { href: "/clinic", label: "Dashboard", icon: "dash" },
    { href: "/clinic/drfs", label: "DRFs", icon: "drfs" },
    { href: "/clinic/cycles", label: "Cycles", icon: "cycles" },
    { href: "/clinic/cohorts", label: "Cohorts", icon: "cohorts" },
  ],
  donor: [{ href: "/donor", label: "Dashboard", icon: "dash" }],
  recipient: [{ href: "/recipient", label: "Dashboard", icon: "dash" }],
};

function NavIcon({ kind }: { kind?: NavIconKind }) {
  const className = "h-4 w-4 shrink-0 opacity-70";
  if (kind === "users") return <Users className={className} />;
  if (kind === "donors") return <UserRound className={className} />;
  if (kind === "samples") return <FlaskConical className={className} />;
  if (kind === "cryo") return <Snowflake className={className} />;
  if (kind === "config") return <Settings2 className={className} />;
  if (kind === "drfs") return <ClipboardList className={className} />;
  if (kind === "dispatches") return <Truck className={className} />;
  if (kind === "challans") return <FileText className={className} />;
  if (kind === "invoices") return <Receipt className={className} />;
  if (kind === "subscriptions") return <Repeat className={className} />;
  if (kind === "payments") return <CreditCard className={className} />;
  if (kind === "finance") return <PieChart className={className} />;
  if (kind === "cycles") return <Activity className={className} />;
  if (kind === "cohorts") return <Microscope className={className} />;
  if (kind === "outcomes") return <Activity className={className} />;
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
              <div key={link.href}>
                <Link
                  href={link.children?.[0]?.href ?? link.href}
                  className={cn(
                    "flex items-center gap-2 rounded-md px-3 py-2 text-sm text-stone-700 hover:bg-stone-100",
                    active && "bg-emerald-50 font-medium text-emerald-900",
                  )}
                >
                  <NavIcon kind={link.icon} />
                  {link.label}
                </Link>
                {link.children && (
                  <div className="ml-6 mt-0.5 flex flex-col gap-0.5">
                    {link.children.map((child) => (
                      <Link
                        key={child.href}
                        href={child.href}
                        className={cn(
                          "rounded-md px-2 py-1.5 text-xs text-stone-600 hover:bg-stone-100",
                          pathname.startsWith(child.href) &&
                            "bg-emerald-50 font-medium text-emerald-900",
                        )}
                      >
                        {child.label}
                      </Link>
                    ))}
                  </div>
                )}
              </div>
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
