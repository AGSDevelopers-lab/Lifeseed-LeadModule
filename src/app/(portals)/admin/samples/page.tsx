import Link from "next/link";
import { redirect } from "next/navigation";
import {
  SampleCategory,
  SampleGrade,
  SamplePriority,
  SampleReleaseTiming,
  SampleState,
} from "@prisma/client";

import { StatusPill } from "@/components/donor/badges";
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
import { SAMPLE_STATE_LABEL } from "@/lib/sample-state";
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

export default async function SamplesListPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!permissionGranted(permissionsForRoles(session.roles), "sample.list")) {
    redirect("/admin");
  }

  const sp = await searchParams;
  const state = one(sp.state) as SampleState | undefined;
  const priority = one(sp.priority) as SamplePriority | undefined;
  const releaseTiming = one(sp.releaseTiming) as
    | SampleReleaseTiming
    | undefined;
  const category = one(sp.category) as SampleCategory | undefined;
  const grade = one(sp.grade) as SampleGrade | undefined;
  const donorQ = one(sp.donor)?.trim();

  const samples = await prisma.sample.findMany({
    where: {
      ...(state ? { state } : {}),
      ...(priority ? { priority } : {}),
      ...(releaseTiming ? { releaseTiming } : {}),
      ...(category ? { category } : {}),
      ...(grade ? { grade } : {}),
      ...(donorQ
        ? {
            OR: [
              { donor: { fullName: { contains: donorQ, mode: "insensitive" } } },
              { donor: { donorCode: { contains: donorQ, mode: "insensitive" } } },
            ],
          }
        : {}),
    },
    include: {
      donor: true,
      site: true,
      vials: { include: { tank: true }, take: 1 },
    },
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-stone-900">Samples</h1>
          <p className="text-sm text-stone-600">
            Andrology pipeline — accessioning through cryostorage handoff.
          </p>
        </div>
        <Link href="/admin/samples/new">
          <Button>Accession Sample</Button>
        </Link>
      </div>

      <form
        method="get"
        action="/admin/samples"
        className="flex flex-wrap gap-3 rounded-xl border border-stone-200 bg-white p-4"
      >
        <Select
          name="state"
          label="State"
          value={state ?? ""}
          options={Object.values(SampleState)}
        />
        <Select
          name="priority"
          label="Priority"
          value={priority ?? ""}
          options={Object.values(SamplePriority)}
        />
        <Select
          name="releaseTiming"
          label="Release timing"
          value={releaseTiming ?? ""}
          options={Object.values(SampleReleaseTiming)}
        />
        <Select
          name="category"
          label="Category"
          value={category ?? ""}
          options={Object.values(SampleCategory)}
        />
        <Select
          name="grade"
          label="Grade"
          value={grade ?? ""}
          options={Object.values(SampleGrade)}
        />
        <label className="flex flex-col gap-1 text-xs font-medium text-stone-600">
          Donor
          <input
            name="donor"
            defaultValue={donorQ ?? ""}
            placeholder="Name or code"
            className="h-10 rounded-md border border-stone-300 px-2 text-sm"
          />
        </label>
        <div className="flex items-end gap-2">
          <Button type="submit">Apply</Button>
          <Link href="/admin/samples">
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
              <TableHead>Sample</TableHead>
              <TableHead>Donor</TableHead>
              <TableHead>State</TableHead>
              <TableHead>Priority</TableHead>
              <TableHead>Timing</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Grade</TableHead>
              <TableHead>Tank / Position</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {samples.length === 0 && (
              <TableRow>
                <TableCell colSpan={8} className="text-center text-stone-500">
                  No samples match the selected filters.
                </TableCell>
              </TableRow>
            )}
            {samples.map((s) => {
              const vial = s.vials[0];
              return (
                <TableRow key={s.id}>
                  <TableCell>
                    <Link
                      href={`/admin/samples/${s.id}`}
                      className="font-medium text-emerald-900 hover:underline"
                    >
                      {s.sampleCode}
                    </Link>
                  </TableCell>
                  <TableCell>
                    <Link
                      href={`/admin/donors/${s.donorId}`}
                      className="hover:underline"
                    >
                      {s.donor.donorCode}
                    </Link>
                  </TableCell>
                  <TableCell>
                    <span className="rounded-full bg-stone-100 px-2 py-0.5 text-xs">
                      {SAMPLE_STATE_LABEL[s.state]}
                    </span>
                  </TableCell>
                  <TableCell>
                    <span
                      className={cn(
                        "rounded-full px-2 py-0.5 text-xs ring-1",
                        s.priority === "URGENT"
                          ? "bg-amber-50 text-amber-900 ring-amber-200"
                          : "bg-stone-50 text-stone-700 ring-stone-200",
                      )}
                    >
                      {s.priority}
                    </span>
                  </TableCell>
                  <TableCell>{s.releaseTiming}</TableCell>
                  <TableCell>
                    {s.category ? (
                      <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs text-emerald-900 ring-1 ring-emerald-200">
                        {s.category}
                      </span>
                    ) : (
                      "—"
                    )}
                  </TableCell>
                  <TableCell>
                    {s.grade ? <StatusPill status={s.grade as never} /> : "—"}
                  </TableCell>
                  <TableCell className="text-xs text-stone-600">
                    {vial
                      ? `${vial.tank.tankCode} · ${vial.canisterCode}/${vial.rackCode}/${vial.positionCode ?? "—"}`
                      : "—"}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

function Select({
  name,
  label,
  value,
  options,
}: {
  name: string;
  label: string;
  value: string;
  options: string[];
}) {
  return (
    <label className="flex flex-col gap-1 text-xs font-medium text-stone-600">
      {label}
      <select
        name={name}
        defaultValue={value}
        className="h-10 min-w-[8rem] rounded-md border border-stone-300 bg-white px-2 text-sm"
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
