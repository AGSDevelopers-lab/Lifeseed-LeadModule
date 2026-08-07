import Link from "next/link";
import { redirect } from "next/navigation";
import { DispatchOrderState } from "@prisma/client";

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
import {
  getSession,
  permissionGranted,
  permissionsForRoles,
} from "@/lib/rbac";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;
function one(v: string | string[] | undefined) {
  return Array.isArray(v) ? v[0] : v;
}

export default async function DispatchesPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const session = await getSession();
  if (!session) redirect("/login");
  if (
    !permissionGranted(permissionsForRoles(session.roles), "dispatch.list")
  ) {
    redirect("/admin");
  }

  const sp = await searchParams;
  const state = one(sp.state) as DispatchOrderState | undefined;
  const courier = one(sp.courier);
  const clinicId = one(sp.clinic);
  const from = one(sp.from);
  const to = one(sp.to);

  const [rows, clinics] = await Promise.all([
    prisma.dispatchOrder.findMany({
      where: {
        ...(state ? { state } : {}),
        ...(courier
          ? { courierVendor: { contains: courier, mode: "insensitive" } }
          : {}),
        ...(clinicId ? { clinicId } : {}),
        ...(from || to
          ? {
              createdAt: {
                ...(from ? { gte: new Date(from) } : {}),
                ...(to ? { lte: new Date(`${to}T23:59:59Z`) } : {}),
              },
            }
          : {}),
      },
      include: { clinic: true, drf: true },
      orderBy: { createdAt: "desc" },
      take: 200,
    }),
    prisma.clinic.findMany({ orderBy: { clinicCode: "asc" } }),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-stone-900">Dispatches</h1>
        <p className="text-sm text-stone-600">
          Cold-chain and donor logistics orders linked to DRFs.
        </p>
      </div>

      <form
        method="get"
        className="flex flex-wrap gap-3 rounded-xl border border-stone-200 bg-white p-4"
      >
        <label className="flex flex-col gap-1 text-xs font-medium text-stone-600">
          State
          <select
            name="state"
            defaultValue={state ?? ""}
            className="h-10 rounded-md border border-stone-300 px-2 text-sm"
          >
            <option value="">All</option>
            {Object.values(DispatchOrderState).map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium text-stone-600">
          Courier
          <input
            name="courier"
            defaultValue={courier ?? ""}
            className="h-10 rounded-md border border-stone-300 px-2 text-sm"
            placeholder="Vendor"
          />
        </label>
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
          <Link href="/admin/dispatches">
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
              <TableHead>Dispatch</TableHead>
              <TableHead>DRF</TableHead>
              <TableHead>Clinic</TableHead>
              <TableHead>State</TableHead>
              <TableHead>Courier</TableHead>
              <TableHead>Tracking</TableHead>
              <TableHead>Scheduled</TableHead>
              <TableHead>Delivered</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={8} className="text-center text-stone-500">
                  No dispatches.
                </TableCell>
              </TableRow>
            )}
            {rows.map((r) => (
              <TableRow key={r.id}>
                <TableCell>
                  <Link
                    href={`/admin/dispatches/${r.id}`}
                    className="font-medium text-emerald-900 hover:underline"
                  >
                    {r.dispatchNumber}
                  </Link>
                </TableCell>
                <TableCell>
                  {r.drf ? (
                    <Link
                      href={`/admin/drfs/${r.drfId}`}
                      className="hover:underline"
                    >
                      {r.drf.drfNumber}
                    </Link>
                  ) : (
                    "—"
                  )}
                </TableCell>
                <TableCell>{r.clinic.clinicCode}</TableCell>
                <TableCell>{r.state}</TableCell>
                <TableCell>{r.courierVendor ?? "—"}</TableCell>
                <TableCell>{r.courierTrackingId ?? "—"}</TableCell>
                <TableCell className="text-xs">
                  {r.scheduledAt?.toISOString().slice(0, 10) ?? "—"}
                </TableCell>
                <TableCell className="text-xs">
                  {r.deliveredAt?.toISOString().slice(0, 10) ?? "—"}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
