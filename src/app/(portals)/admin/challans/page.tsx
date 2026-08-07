import Link from "next/link";
import { redirect } from "next/navigation";
import { ChallanStatus } from "@prisma/client";

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

function money(v: { toString(): string }) {
  return Number(v.toString()).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export default async function ChallansPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const session = await getSession();
  if (!session) redirect("/login");
  if (
    !permissionGranted(permissionsForRoles(session.roles), "challan.list")
  ) {
    redirect("/admin");
  }

  const sp = await searchParams;
  const status = one(sp.status) as ChallanStatus | undefined;

  const rows = await prisma.challan.findMany({
    where: status ? { status } : {},
    include: {
      drf: true,
      site: true,
    },
    orderBy: { issuedAt: "desc" },
    take: 200,
  });

  const clinics = await prisma.clinic.findMany({
    where: { id: { in: [...new Set(rows.map((r) => r.buyerId))] } },
  });
  const clinicMap = new Map(clinics.map((c) => [c.id, c]));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-stone-900">Challans</h1>
        <p className="text-sm text-stone-600">
          Challan-first billing — converts to invoice on DRF Delivered.
        </p>
      </div>

      <form
        method="get"
        className="flex flex-wrap gap-3 rounded-xl border border-stone-200 bg-white p-4"
      >
        <label className="flex flex-col gap-1 text-xs font-medium text-stone-600">
          Status
          <select
            name="status"
            defaultValue={status ?? ""}
            className="h-10 rounded-md border border-stone-300 px-2 text-sm"
          >
            <option value="">All</option>
            {Object.values(ChallanStatus).map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>
        <div className="flex items-end gap-2">
          <Button type="submit">Apply</Button>
          <Link href="/admin/challans">
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
              <TableHead>Challan</TableHead>
              <TableHead>DRF</TableHead>
              <TableHead>Clinic</TableHead>
              <TableHead>Amount</TableHead>
              <TableHead>GST</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Raised</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-stone-500">
                  No challans.
                </TableCell>
              </TableRow>
            )}
            {rows.map((r) => (
              <TableRow key={r.id}>
                <TableCell className="font-medium">{r.challanNumber}</TableCell>
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
                <TableCell>
                  {clinicMap.get(r.buyerId)?.clinicCode ?? r.buyerId.slice(0, 8)}
                </TableCell>
                <TableCell>₹{money(r.totalWithGst)}</TableCell>
                <TableCell>₹{money(r.totalGst)}</TableCell>
                <TableCell>{r.status}</TableCell>
                <TableCell className="text-xs">
                  {r.issuedAt.toISOString().slice(0, 10)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
