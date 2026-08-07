import Link from "next/link";
import { redirect } from "next/navigation";
import {
  DonorPhase,
  DonorStatus,
  DonorType,
  SiteCode,
} from "@prisma/client";

import {
  NextActionBadge,
  PhaseBadge,
  StatusPill,
} from "@/components/donor/badges";
import { Button } from "@/components/ui/primitives";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { prisma } from "@/lib/db";
import { nextActionLabel } from "@/lib/donor-phase";
import {
  getSession,
  permissionGranted,
  permissionsForRoles,
} from "@/lib/rbac";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function one(v: string | string[] | undefined): string | undefined {
  if (Array.isArray(v)) return v[0];
  return v;
}

export default async function DonorsListPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!permissionGranted(permissionsForRoles(session.roles), "donor.list")) {
    redirect("/admin");
  }

  const sp = await searchParams;
  const phase = one(sp.phase) as DonorPhase | undefined;
  const status = one(sp.status) as DonorStatus | undefined;
  const type = one(sp.type) as DonorType | undefined;
  const siteCode = one(sp.site) as SiteCode | undefined;

  const site =
    siteCode &&
    (await prisma.site.findUnique({ where: { code: siteCode } }));

  const donors = await prisma.donor.findMany({
    where: {
      ...(phase ? { phase } : {}),
      ...(status ? { status } : {}),
      ...(type ? { type } : {}),
      ...(site ? { siteId: site.id } : {}),
    },
    include: {
      site: true,
      _count: { select: { samples: true, consents: true, labTests: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  const sites = await prisma.site.findMany({ orderBy: { code: "asc" } });

  function hrefWith(overrides: Record<string, string | undefined>) {
    const params = new URLSearchParams();
    const merged = {
      phase: phase ?? "",
      status: status ?? "",
      type: type ?? "",
      site: siteCode ?? "",
      ...overrides,
    };
    for (const [k, v] of Object.entries(merged)) {
      if (v) params.set(k, v);
    }
    const q = params.toString();
    return q ? `/admin/donors?${q}` : "/admin/donors";
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-stone-900">Donors</h1>
          <p className="text-sm text-stone-600">
            Donor pathway register — intake through outcome (P0–P4).
          </p>
        </div>
        <Link href="/admin/donors/new">
          <Button>New Donor</Button>
        </Link>
      </div>

      <form
        method="get"
        action="/admin/donors"
        className="flex flex-wrap gap-3 rounded-xl border border-stone-200 bg-white p-4"
      >
        <FilterSelect
          name="phase"
          label="Phase"
          value={phase ?? ""}
          options={Object.values(DonorPhase).map((p) => ({
            value: p,
            label: p,
          }))}
        />
        <FilterSelect
          name="status"
          label="Status"
          value={status ?? ""}
          options={Object.values(DonorStatus).map((s) => ({
            value: s,
            label: s,
          }))}
        />
        <FilterSelect
          name="type"
          label="Type"
          value={type ?? ""}
          options={Object.values(DonorType).map((t) => ({
            value: t,
            label: t,
          }))}
        />
        <FilterSelect
          name="site"
          label="Site"
          value={siteCode ?? ""}
          options={sites.map((s) => ({ value: s.code, label: s.code }))}
        />
        <div className="flex items-end gap-2">
          <Button type="submit">Apply</Button>
          <Link href="/admin/donors">
            <Button type="button" variant="outline">
              Clear
            </Button>
          </Link>
        </div>
      </form>

      <div className="rounded-xl border border-stone-200 bg-white">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Code</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Phase</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Site</TableHead>
              <TableHead>Samples</TableHead>
              <TableHead>Next action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {donors.length === 0 && (
              <TableRow>
                <TableCell colSpan={8} className="text-center text-stone-500">
                  No donors match the selected filters.
                </TableCell>
              </TableRow>
            )}
            {donors.map((d) => (
              <TableRow key={d.id} className="cursor-pointer">
                <TableCell>
                  <Link
                    href={`/admin/donors/${d.id}`}
                    className="font-medium text-emerald-900 hover:underline"
                  >
                    {d.donorCode}
                  </Link>
                </TableCell>
                <TableCell>
                  <Link href={`/admin/donors/${d.id}`}>{d.fullName}</Link>
                </TableCell>
                <TableCell>{d.type}</TableCell>
                <TableCell>
                  <PhaseBadge phase={d.phase} />
                </TableCell>
                <TableCell>
                  <StatusPill status={d.status} />
                </TableCell>
                <TableCell>{d.site.code}</TableCell>
                <TableCell>{d._count.samples}</TableCell>
                <TableCell>
                  <NextActionBadge label={nextActionLabel(d)} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Preserve unused helper for typed filter links in future */}
      <span className="hidden">{hrefWith({})}</span>
    </div>
  );
}

function FilterSelect({
  name,
  label,
  value,
  options,
}: {
  name: string;
  label: string;
  value: string;
  options: Array<{ value: string; label: string }>;
}) {
  return (
    <label className="flex flex-col gap-1 text-xs font-medium text-stone-600">
      {label}
      <select
        name={name}
        defaultValue={value}
        className="h-10 min-w-[9rem] rounded-md border border-stone-300 bg-white px-2 text-sm text-stone-900"
      >
        <option value="">All</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}
