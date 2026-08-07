import Link from "next/link";
import { redirect } from "next/navigation";
import {
  DispatchType,
  DrfState,
  SamplePriority,
} from "@prisma/client";

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
import { DRF_STATE_LABEL } from "@/lib/drf-state";
import {
  getSession,
  permissionGranted,
  permissionsForRoles,
} from "@/lib/rbac";
import { cn } from "@/lib/utils";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;
function one(v: string | string[] | undefined) {
  return Array.isArray(v) ? v[0] : v;
}

export default async function AdminDrfsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!permissionGranted(permissionsForRoles(session.roles), "drf.list")) {
    redirect("/admin");
  }

  const sp = await searchParams;
  const state = one(sp.state) as DrfState | undefined;
  const type = one(sp.type) as DispatchType | undefined;
  const priority = one(sp.priority) as SamplePriority | undefined;
  const clinicId = one(sp.clinic);
  const siteId = one(sp.site);
  const from = one(sp.from);
  const to = one(sp.to);

  const [rows, clinics, sites] = await Promise.all([
    prisma.dRF.findMany({
      where: {
        ...(state ? { state } : {}),
        ...(type ? { type } : {}),
        ...(priority ? { priority } : {}),
        ...(clinicId ? { clinicId } : {}),
        ...(siteId ? { siteId } : {}),
        ...(from || to
          ? {
              createdAt: {
                ...(from ? { gte: new Date(from) } : {}),
                ...(to ? { lte: new Date(`${to}T23:59:59Z`) } : {}),
              },
            }
          : {}),
      },
      include: { clinic: true, site: true },
      orderBy: [{ priority: "desc" }, { createdAt: "desc" }],
      take: 200,
    }),
    prisma.clinic.findMany({ orderBy: { clinicCode: "asc" } }),
    prisma.site.findMany({ orderBy: { code: "asc" } }),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-stone-900">DRFs</h1>
          <p className="text-sm text-stone-600">
            Donor requisition pull queue — priority URGENT sorts first.
          </p>
        </div>
        {permissionGranted(permissionsForRoles(session.roles), "drf.create") && (
          <Link href="/admin/drfs/new">
            <Button>New DRF</Button>
          </Link>
        )}
      </div>

      <form
        method="get"
        className="flex flex-wrap gap-3 rounded-xl border border-stone-200 bg-white p-4"
      >
        <FilterSelect
          name="state"
          label="State"
          value={state}
          options={Object.values(DrfState)}
        />
        <FilterSelect
          name="type"
          label="Type"
          value={type}
          options={Object.values(DispatchType)}
        />
        <FilterSelect
          name="priority"
          label="Priority"
          value={priority}
          options={Object.values(SamplePriority)}
        />
        <label className="flex flex-col gap-1 text-xs font-medium text-stone-600">
          Clinic
          <select
            name="clinic"
            defaultValue={clinicId ?? ""}
            className="h-10 rounded-md border border-stone-300 px-2 text-sm"
          >
            <option value="">All</option>
            {clinics.map((c) => (
              <option key={c.id} value={c.id}>
                {c.clinicCode}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium text-stone-600">
          Site
          <select
            name="site"
            defaultValue={siteId ?? ""}
            className="h-10 rounded-md border border-stone-300 px-2 text-sm"
          >
            <option value="">All</option>
            {sites.map((s) => (
              <option key={s.id} value={s.id}>
                {s.code}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium text-stone-600">
          From
          <input
            type="date"
            name="from"
            defaultValue={from ?? ""}
            className="h-10 rounded-md border border-stone-300 px-2 text-sm"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium text-stone-600">
          To
          <input
            type="date"
            name="to"
            defaultValue={to ?? ""}
            className="h-10 rounded-md border border-stone-300 px-2 text-sm"
          />
        </label>
        <div className="flex items-end gap-2">
          <Button type="submit">Apply</Button>
          <Link href="/admin/drfs">
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
              <TableHead>DRF</TableHead>
              <TableHead>Clinic</TableHead>
              <TableHead>Site</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Priority</TableHead>
              <TableHead>State</TableHead>
              <TableHead>Created</TableHead>
              <TableHead>Expected</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={9} className="text-center text-stone-500">
                  No DRFs found.
                </TableCell>
              </TableRow>
            )}
            {rows.map((r) => (
              <TableRow
                key={r.id}
                className={cn(r.priority === "URGENT" && "bg-amber-50/60")}
              >
                <TableCell className="font-medium">{r.drfNumber}</TableCell>
                <TableCell>{r.clinic.clinicCode}</TableCell>
                <TableCell>{r.site.code}</TableCell>
                <TableCell className="text-xs">{r.type}</TableCell>
                <TableCell>
                  <Badge urgent={r.priority === "URGENT"}>{r.priority}</Badge>
                </TableCell>
                <TableCell>
                  <Badge>{DRF_STATE_LABEL[r.state]}</Badge>
                </TableCell>
                <TableCell className="text-xs text-stone-600">
                  {r.createdAt.toISOString().slice(0, 10)}
                </TableCell>
                <TableCell className="text-xs text-stone-600">
                  {r.expectedDeliveryAt?.toISOString().slice(0, 10) ?? "—"}
                </TableCell>
                <TableCell>
                  <Link
                    href={`/admin/drfs/${r.id}`}
                    className="text-sm text-emerald-900 hover:underline"
                  >
                    Open
                  </Link>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
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
  value?: string;
  options: string[];
}) {
  return (
    <label className="flex flex-col gap-1 text-xs font-medium text-stone-600">
      {label}
      <select
        name={name}
        defaultValue={value ?? ""}
        className="h-10 rounded-md border border-stone-300 px-2 text-sm"
      >
        <option value="">All</option>
        {options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
    </label>
  );
}

function Badge({
  children,
  urgent,
}: {
  children: React.ReactNode;
  urgent?: boolean;
}) {
  return (
    <span
      className={cn(
        "rounded-full px-2 py-0.5 text-xs ring-1",
        urgent
          ? "bg-amber-50 text-amber-900 ring-amber-200"
          : "bg-stone-100 text-stone-800 ring-stone-200",
      )}
    >
      {children}
    </span>
  );
}
