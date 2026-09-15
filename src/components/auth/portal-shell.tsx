"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Activity,
  Bell,
  ChevronDown,
  ClipboardList,
  CreditCard,
  Download,
  FileText,
  FlaskConical,
  Headset,
  LayoutDashboard,
  LogOut,
  Microscope,
  MoreHorizontal,
  PieChart,
  Pin,
  Plus,
  Receipt,
  Repeat,
  Search,
  Settings2,
  Snowflake,
  Truck,
  Users,
  UserRound,
} from "lucide-react";

import { useCan, useRoleContext } from "@/components/auth/role-provider";
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
  | "outcomes"
  | "leads"
  | "headset"
  | "reports";

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
    {
      href: "/admin/leads",
      label: "Leads",
      icon: "leads",
      children: [
        { href: "/admin/leads", label: "All Leads" },
        { href: "/admin/leads/analytics", label: "Analytics" },
        { href: "/admin/leads/campaigns", label: "Campaigns" },
        { href: "/admin/leads/crm", label: "CRM sync" },
        { href: "/admin/leads/do-not-call", label: "Do Not Call" },
        { href: "/admin/leads/config", label: "Lead config" },
      ],
    },
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
      href: "/admin/reports",
      label: "Reports",
      icon: "reports",
      children: [
        { href: "/admin/reports", label: "Dashboard" },
        { href: "/admin/reports/clinical", label: "Clinical" },
        { href: "/admin/reports/finance", label: "Finance" },
        { href: "/admin/reports/logistics", label: "Logistics" },
        { href: "/admin/reports/compliance", label: "Compliance" },
        { href: "/admin/reports/favorites", label: "My Favorites" },
        { href: "/admin/reports/schedules", label: "Schedules" },
      ],
    },
    {
      href: "/admin/config",
      label: "Config",
      icon: "config",
      children: [
        { href: "/admin/config/qc-gates", label: "QC Gates" },
        { href: "/admin/config/categories", label: "Categories" },
        { href: "/admin/config/seedscore", label: "SeedScore Rubric" },
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
  telecaller: [
    { href: "/telecaller/dashboard", label: "Dashboard", icon: "dash" },
    { href: "/telecaller/queue", label: "My Queue", icon: "leads" },
    { href: "/telecaller/leads", label: "All Leads", icon: "users" },
    { href: "/telecaller/follow-ups", label: "Follow-ups", icon: "headset" },
    { href: "/telecaller/do-not-call", label: "Do Not Call", icon: "headset" },
  ],
  counsellor: [
    { href: "/counsellor/dashboard", label: "Dashboard", icon: "dash" },
    { href: "/counsellor/sessions", label: "Sessions", icon: "headset" },
  ],
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
  if (kind === "leads") return <Headset className={className} />;
  if (kind === "headset") return <Headset className={className} />;
  if (kind === "reports") return <Pin className={className} />;
  return <LayoutDashboard className={className} />;
}

/* ---------------------------------------------------------------------- *
 * Chakra bar — full-width brand + module strip, rendered above every
 * admin page. Draft 3 shipped this as a plain dot rail; Draft 4 widens it
 * to carry the brand mark (moved here from the sidebar, see PortalShell
 * below) and gives each node its traditional lotus-petal symbol in place
 * of a dot, per the Founder-approved mockup.
 * ---------------------------------------------------------------------- */
type ChakraNode = {
  key: string;
  label: string;
  sanskrit: string;
  href: string;
  hex: string;
  /** Traditional petal count for this chakra. Sahasrara is traditionally
   *  drawn with a thousand petals; 20 is used here as a legible stand-in,
   *  carried over from the Draft 4 mockup rather than invented fresh. */
  petals: number;
  textClass: string;
  disabled?: boolean;
};

const CHAKRA_NODES: ChakraNode[] = [
  { key: "foundation", label: "Foundation", sanskrit: "Muladhara", href: "/admin", hex: "#b91c1c", petals: 4, textClass: "text-red-700" },
  { key: "lead", label: "Lead", sanskrit: "Svadhisthana", href: "/admin/leads", hex: "#ee7a34", petals: 6, textClass: "text-brand-800" },
  { key: "andrology", label: "Andrology", sanskrit: "Manipura", href: "/admin/samples", hex: "#f59e0b", petals: 10, textClass: "text-amber-700" },
  { key: "embryology", label: "Embryology", sanskrit: "Anahata", href: "", hex: "#10b981", petals: 12, textClass: "text-emerald-700", disabled: true },
  { key: "dispatch", label: "Dispatch", sanskrit: "Vishuddha", href: "/admin/dispatches", hex: "#3b82f6", petals: 16, textClass: "text-blue-700" },
  { key: "finance", label: "Finance", sanskrit: "Ajna", href: "/admin/dashboard/finance", hex: "#6366f1", petals: 2, textClass: "text-indigo-700" },
  { key: "admin", label: "Admin", sanskrit: "Sahasrara", href: "/admin/config", hex: "#8b5cf6", petals: 20, textClass: "text-violet-700" },
];

/** Parametric lotus-petal glyph — petal count is the chakra's real
 *  traditional attribute, so it's generated, not hand-drawn per icon. */
function ChakraLotus({ petals, color }: { petals: number; color: string }) {
  const cx = 20;
  const cy = 20;
  const tipR = 15;
  const ctrlR = 8.4;
  const ctrlSpread = 5.6;
  const petalPaths: string[] = [];
  for (let i = 0; i < petals; i++) {
    const angle = ((-90 + (360 / petals) * i) * Math.PI) / 180;
    const ux = Math.cos(angle);
    const uy = Math.sin(angle);
    const px = -uy;
    const py = ux;
    const tipX = cx + ux * tipR;
    const tipY = cy + uy * tipR;
    const c1x = cx + ux * ctrlR + px * ctrlSpread;
    const c1y = cy + uy * ctrlR + py * ctrlSpread;
    const c2x = cx + ux * ctrlR - px * ctrlSpread;
    const c2y = cy + uy * ctrlR - py * ctrlSpread;
    petalPaths.push(
      `M ${cx} ${cy} Q ${c1x.toFixed(1)} ${c1y.toFixed(1)} ${tipX.toFixed(1)} ${tipY.toFixed(1)} Q ${c2x.toFixed(1)} ${c2y.toFixed(1)} ${cx} ${cy} Z`,
    );
  }
  return (
    <svg viewBox="0 0 40 40" className="h-full w-full" aria-hidden="true">
      {petalPaths.map((d, i) => (
        <path key={i} d={d} fill={color} fillOpacity={0.16} stroke={color} strokeWidth={1} />
      ))}
      <circle cx={cx} cy={cy} r={2.6} fill={color} />
    </svg>
  );
}

function ChakraBar({ pathname }: { pathname: string }) {
  const currentKey =
    CHAKRA_NODES.find((n) => n.href && n.href !== "/admin" && pathname.startsWith(n.href))?.key ??
    (pathname === "/admin" ? "foundation" : undefined);

  return (
    <div className="flex items-center gap-1 border-b border-stone-200 bg-white px-4 py-1.5">
      <div className="mr-3 flex shrink-0 items-center border-r border-stone-200 pr-3">
        {/* eslint-disable-next-line @next/next/no-img-element -- brand JPEG wordmark, moved here from the sidebar per Draft 4 */}
        <img
          src="/brand/lifeseed-logo.jpg"
          alt="LifeSeed — Butterfly Bio & ART LLP"
          className="h-6 w-auto"
        />
      </div>
      <nav className="flex flex-1 items-center justify-center gap-0.5" aria-label="Module navigation">
        {CHAKRA_NODES.map((node) => {
          const isCurrent = node.key === currentKey;
          const content = (
            <div className="flex flex-col items-center gap-0.5 rounded-lg px-2.5 py-1">
              <span
                className={cn(
                  "h-6 w-6 transition-opacity",
                  isCurrent ? "scale-110 opacity-100" : "opacity-50",
                  node.disabled && "opacity-25",
                )}
              >
                <ChakraLotus petals={node.petals} color={node.hex} />
              </span>
              <span
                className={cn(
                  "text-[9.5px] font-semibold tracking-wide",
                  isCurrent ? node.textClass : "text-stone-500",
                  node.disabled && "text-stone-300",
                )}
              >
                {node.label}
              </span>
              <span className="text-[8px] italic text-stone-300">{node.sanskrit}</span>
            </div>
          );
          if (node.disabled) {
            return (
              <span key={node.key} className="cursor-not-allowed" title="Coming soon" aria-disabled="true">
                {content}
              </span>
            );
          }
          return (
            <Link key={node.key} href={node.href} className="rounded-lg hover:bg-stone-50">
              {content}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}

/* ---------------------------------------------------------------------- *
 * Lead-module rail shell — Draft 4. Scoped to /admin/leads* only; every
 * other admin route keeps the existing sidebar shell below unchanged.
 * ---------------------------------------------------------------------- */

/** The 6 chakra-mapped destinations shown as icons on the rail. Everything
 *  else in NAV.admin is derived into the "More" overflow below, so the
 *  overflow list stays in sync if NAV.admin ever changes. */
const RAIL_CURATED_HREFS = [
  "/admin",
  "/admin/leads",
  "/admin/samples",
  "/admin/dispatches",
  "/admin/dashboard/finance",
  "/admin/config",
];

function IconRail({ pathname, avatarInitial }: { pathname: string; avatarInitial: string }) {
  const [moreOpen, setMoreOpen] = React.useState(false);
  const moreRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (moreRef.current && !moreRef.current.contains(e.target as Node)) {
        setMoreOpen(false);
      }
    }
    document.addEventListener("click", onDocClick);
    return () => document.removeEventListener("click", onDocClick);
  }, []);

  const curated = NAV.admin.filter((item) => RAIL_CURATED_HREFS.includes(item.href));
  const overflow = NAV.admin.filter((item) => !RAIL_CURATED_HREFS.includes(item.href));

  return (
    <nav className="flex w-16 shrink-0 flex-col items-center gap-1 border-r border-stone-200 bg-white py-4" aria-label="Portal navigation">
      {curated.map((item) => {
        const active =
          item.href === "/admin"
            ? pathname === "/admin"
            : pathname === item.href || pathname.startsWith(`${item.href}/`);
        return (
          <Link
            key={item.href}
            href={item.children?.[0]?.href ?? item.href}
            title={item.label}
            className={cn(
              "relative flex h-10 w-10 items-center justify-center rounded-xl text-stone-500 hover:bg-stone-50 hover:text-stone-700",
              active && "bg-brand-50 text-brand-700",
            )}
          >
            {active && (
              <span className="absolute -left-1 top-1/2 h-4 w-[3px] -translate-y-1/2 rounded-r-sm bg-brand-600" aria-hidden="true" />
            )}
            <NavIcon kind={item.icon} />
          </Link>
        );
      })}

      <div ref={moreRef} className="relative">
        <div className="my-1.5 h-px w-6 bg-stone-200" aria-hidden="true" />
        <button
          type="button"
          title="More modules"
          aria-expanded={moreOpen}
          onClick={() => setMoreOpen((v) => !v)}
          className={cn(
            "flex h-10 w-10 items-center justify-center rounded-xl text-stone-500 hover:bg-stone-50 hover:text-stone-700",
            moreOpen && "bg-brand-50 text-brand-700",
          )}
        >
          <MoreHorizontal className="h-[19px] w-[19px]" />
        </button>
        {moreOpen && (
          <div className="absolute left-[54px] top-0 z-40 w-48 rounded-xl border border-stone-200 bg-surface-raised p-2 shadow-[0_10px_26px_-8px_rgba(43,36,32,0.22)]">
            <div className="px-2 pb-1.5 pt-0.5 text-[10px] font-semibold uppercase tracking-wide text-stone-500">
              More modules
            </div>
            {overflow.map((item) => (
              <Link
                key={item.href}
                href={item.children?.[0]?.href ?? item.href}
                onClick={() => setMoreOpen(false)}
                className="block rounded-lg px-2.5 py-1.5 text-[13px] font-medium text-stone-700 hover:bg-brand-50 hover:text-brand-700"
              >
                {item.label}
              </Link>
            ))}
          </div>
        )}
      </div>

      <div className="flex-1" />
      <div
        className="flex h-[34px] w-[34px] items-center justify-center rounded-full bg-stone-200 text-xs font-bold text-stone-700"
        title="Account"
      >
        {avatarInitial}
      </div>
    </nav>
  );
}

/** Lead-module context panel. Deliberately navigation-only for Draft 4 —
 *  the mockup showed live funnel/SLA counts, but PortalShell is a client
 *  component with no path to the server-computed counts on
 *  admin/leads/page.tsx without adding a new data-fetch layer to a shared
 *  shell. That's a real architecture decision, not a styling one, so it's
 *  deliberately left out here rather than assumed — see the dispatch
 *  package's open-items note. */
function LeadContextPanel() {
  return (
    <aside className="flex w-[250px] shrink-0 flex-col bg-[#fffaf4] p-5 text-stone-800">
      <button
        type="button"
        disabled
        title="Coming soon"
        aria-disabled="true"
        className="flex cursor-not-allowed items-center gap-2 rounded-xl border border-brand-100 bg-brand-50 px-3.5 py-2.5 text-sm font-bold text-stone-400"
      >
        <Plus className="h-4 w-4" />
        New lead
      </button>

      <div className="mt-5 text-xl font-extrabold tracking-tight">Leads</div>

      <div className="mt-5 text-[10.5px] font-bold uppercase tracking-wide text-stone-500">Filter by status</div>
      <nav className="mt-1 flex flex-col gap-0.5">
        <Link href="/admin/leads?status=NEW" className="rounded-lg px-2.5 py-2 text-[13px] font-semibold hover:bg-brand-50">
          New
        </Link>
        <Link href="/admin/leads" className="rounded-lg px-2.5 py-2 text-[13px] font-semibold hover:bg-brand-50">
          All leads
        </Link>
        <Link href="/admin/leads?status=CONVERTED" className="rounded-lg px-2.5 py-2 text-[13px] font-semibold hover:bg-brand-50">
          Converted
        </Link>
      </nav>

      <div className="mt-5 text-[10.5px] font-bold uppercase tracking-wide text-stone-500">SLA</div>
      <nav className="mt-1 flex flex-col gap-0.5">
        <Link href="/admin/leads?sla=at-risk" className="rounded-lg px-2.5 py-2 text-[13px] font-semibold hover:bg-brand-50">
          At-risk · ≤2h
        </Link>
        <Link href="/admin/leads?sla=breached" className="rounded-lg px-2.5 py-2 text-[13px] font-semibold hover:bg-brand-50">
          Breached
        </Link>
      </nav>

      <div className="flex-1" />
      <div className="border-t border-stone-200 pt-3 text-[11px] text-stone-500">
        Svadhisthana · Sacral chakra
        <br />
        Butterfly Bio &amp; ART LLP
      </div>
    </aside>
  );
}

const LEAD_SUBNAV: Array<{ href: string; label: string }> = [
  { href: "/admin/leads/analytics", label: "Analytics" },
  { href: "/admin/leads/command-centre", label: "Command centre" },
  { href: "/admin/leads/sla-monitor", label: "SLA monitor" },
  { href: "/admin/leads/audit", label: "Audit" },
  { href: "/admin/leads/campaigns", label: "Campaigns" },
  { href: "/admin/leads/crm", label: "CRM sync" },
  { href: "/admin/leads/do-not-call", label: "Do Not Call" },
  { href: "/admin/leads/config", label: "Config" },
  { href: "/admin/leads/assignment", label: "Assignment" },
  { href: "/admin/leads/notifications/templates", label: "Templates" },
  { href: "/admin/leads/notifications/delivery-log", label: "Delivery log" },
];

function LeadSubNav({ pathname, canExport }: { pathname: string; canExport: boolean }) {
  return (
    <div className="flex flex-wrap items-center gap-1 border-b border-stone-200 bg-white px-6 pb-2.5">
      {LEAD_SUBNAV.map((tab) => {
        const active = pathname.startsWith(tab.href);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={cn(
              "whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-semibold text-stone-500 hover:bg-brand-50 hover:text-brand-700",
              active && "bg-brand-500 text-white hover:bg-brand-500 hover:text-white",
            )}
          >
            {tab.label}
          </Link>
        );
      })}
      {canExport && (
        <a
          href="/api/leads/export"
          className="ml-1 flex items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-semibold text-stone-500 hover:bg-brand-50 hover:text-brand-700"
        >
          <Download className="h-3.5 w-3.5" />
          Export CSV
        </a>
      )}
    </div>
  );
}

/** Search and notifications are visual-only in the Draft 4 mockup — there
 *  is no search backend or notification feed behind either yet. Rendering
 *  them as disabled affordances (title="Coming soon") reuses the pattern
 *  already shipped for the profile-menu items below, rather than shipping
 *  a control that looks live but does nothing. */
function TopBar({
  email,
  avatarInitial,
  onLogout,
}: {
  email: string;
  avatarInitial: string;
  onLogout: () => void;
}) {
  return (
    <header className="flex h-14 shrink-0 items-center gap-4 border-b border-stone-200 bg-white px-5">
      <div
        className="flex max-w-[380px] flex-1 cursor-not-allowed items-center gap-2 rounded-lg border border-stone-200 bg-stone-50 px-3 py-2 text-stone-400"
        title="Coming soon"
        aria-disabled="true"
      >
        <Search className="h-[15px] w-[15px] shrink-0" />
        <span className="truncate text-[13.5px]">Search leads by name, code, phone…</span>
      </div>
      <div className="flex-1" />
      <div
        className="flex h-[34px] w-[34px] cursor-not-allowed items-center justify-center rounded-lg text-stone-300"
        title="Coming soon"
        aria-disabled="true"
      >
        <Bell className="h-[17px] w-[17px]" />
      </div>
      <details className="relative">
        <summary className="flex cursor-pointer list-none items-center gap-2 rounded-md px-2 py-1.5 text-sm text-stone-700 hover:bg-brand-50 hover:text-brand-800 [&::-webkit-details-marker]:hidden">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-50 font-medium text-brand-800">
            {avatarInitial}
          </span>
          <span className="max-w-[14rem] truncate">{email}</span>
          <ChevronDown className="h-4 w-4 shrink-0" />
        </summary>
        <div className="absolute right-0 z-20 mt-1 w-60 rounded-md border border-stone-200 bg-surface-raised py-1 shadow-[0_2px_10px_-2px_rgba(180,90,30,0.12)]">
          <div className="cursor-not-allowed px-3 py-2 text-sm text-stone-400" aria-disabled="true" title="Coming soon">
            View profile
            <span className="ml-1 text-xs">(coming soon)</span>
          </div>
          <div className="cursor-not-allowed px-3 py-2 text-sm text-stone-400" aria-disabled="true" title="Coming soon">
            Update details
            <span className="ml-1 text-xs">(coming soon)</span>
          </div>
          <div className="cursor-not-allowed px-3 py-2 text-sm text-stone-400" aria-disabled="true" title="Coming soon">
            Change password
            <span className="ml-1 text-xs">(coming soon)</span>
          </div>
          <div className="cursor-not-allowed px-3 py-2 text-sm text-stone-400" aria-disabled="true" title="Coming soon">
            Notification settings
            <span className="ml-1 text-xs">(coming soon)</span>
          </div>
          <div className="my-1 border-t border-stone-200" />
          <button
            type="button"
            onClick={onLogout}
            className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-stone-800 hover:bg-brand-50 hover:text-brand-800"
          >
            <LogOut className="h-4 w-4" />
            Sign out
          </button>
        </div>
      </details>
    </header>
  );
}

export function PortalShell({ children }: { children: React.ReactNode }) {
  const { email, roles } = useRoleContext();
  const canExportLeads = useCan("lead.export");
  const pathname = usePathname();
  const router = useRouter();

  const primaryPortal = roles.length
    ? portalForRole(roles[0])
    : ("admin" as PortalKind);

  const activePortal: PortalKind =
    (
      [
        "admin",
        "clinic",
        "donor",
        "recipient",
        "telecaller",
        "counsellor",
      ] as PortalKind[]
    ).find((p) => pathname.startsWith(`/${p}`)) ?? primaryPortal;

  const links = NAV[activePortal];
  const avatarInitial = (email?.trim().charAt(0) || "?").toUpperCase();
  const isLeadModule = activePortal === "admin" && pathname.startsWith("/admin/leads");

  async function logout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  if (isLeadModule) {
    return (
      <div className="flex min-h-screen flex-col bg-stone-50">
        <ChakraBar pathname={pathname} />
        <div className="flex flex-1">
          <IconRail pathname={pathname} avatarInitial={avatarInitial} />
          <LeadContextPanel />
          <div className="flex min-w-0 min-h-0 flex-1 flex-col">
            <TopBar email={email} avatarInitial={avatarInitial} onLogout={logout} />
            <LeadSubNav pathname={pathname} canExport={canExportLeads} />
            <main className="flex-1 overflow-x-auto p-6">{children}</main>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-stone-50">
      {activePortal === "admin" && <ChakraBar pathname={pathname} />}
      <div className="flex flex-1">
      <aside className="hidden w-56 shrink-0 border-r border-stone-200 bg-white p-4 md:block">
        <div className="mb-6">
          {activePortal !== "admin" && (
            // eslint-disable-next-line @next/next/no-img-element -- brand JPEG wordmark per Draft 2 dispatch
            <img
              src="/brand/lifeseed-logo.jpg"
              alt="LifeSeed — Butterfly Bio & ART LLP"
              className="h-6 w-auto rounded bg-white p-0.5"
            />
          )}
          <div className={cn("text-sm capitalize text-stone-500", activePortal !== "admin" && "mt-1")}>{activePortal}</div>
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
                    active && "bg-brand-50 font-medium text-brand-800",
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
                            "bg-brand-50 font-medium text-brand-800",
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

      <div className="flex min-h-0 flex-1 flex-col">
        <header className="flex h-14 items-center justify-end border-b border-stone-200 bg-white px-4">
          <details className="relative">
            <summary className="flex cursor-pointer list-none items-center gap-2 rounded-md px-2 py-1.5 text-sm text-stone-700 hover:bg-brand-50 hover:text-brand-800 [&::-webkit-details-marker]:hidden">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-50 font-medium text-brand-800">
                {avatarInitial}
              </span>
              <span className="max-w-[14rem] truncate">{email}</span>
              <ChevronDown className="h-4 w-4 shrink-0" />
            </summary>
            <div className="absolute right-0 z-20 mt-1 w-60 rounded-md border border-stone-200 bg-surface-raised py-1 shadow-[0_2px_10px_-2px_rgba(180,90,30,0.12)]">
              <div
                className="cursor-not-allowed px-3 py-2 text-sm text-stone-400"
                aria-disabled="true"
                title="Coming soon"
              >
                View profile
                <span className="ml-1 text-xs">(coming soon)</span>
              </div>
              <div
                className="cursor-not-allowed px-3 py-2 text-sm text-stone-400"
                aria-disabled="true"
                title="Coming soon"
              >
                Update details
                <span className="ml-1 text-xs">(coming soon)</span>
              </div>
              <div
                className="cursor-not-allowed px-3 py-2 text-sm text-stone-400"
                aria-disabled="true"
                title="Coming soon"
              >
                Change password
                <span className="ml-1 text-xs">(coming soon)</span>
              </div>
              <div
                className="cursor-not-allowed px-3 py-2 text-sm text-stone-400"
                aria-disabled="true"
                title="Coming soon"
              >
                Notification settings
                <span className="ml-1 text-xs">(coming soon)</span>
              </div>
              <div className="my-1 border-t border-stone-200" />
              <button
                type="button"
                onClick={logout}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-stone-800 hover:bg-brand-50 hover:text-brand-800"
              >
                <LogOut className="h-4 w-4" />
                Sign out
              </button>
            </div>
          </details>
        </header>
        <main className="flex-1 p-6">{children}</main>
      </div>
      </div>
    </div>
  );
}
