import Link from "next/link";
import { redirect } from "next/navigation";
import { InvoiceStatus } from "@prisma/client";

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
import { cn } from "@/lib/utils";

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

export default async function InvoicesPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const session = await getSession();
  if (!session) redirect("/login");
  if (
    !permissionGranted(permissionsForRoles(session.roles), "invoice.list")
  ) {
    redirect("/admin");
  }

  const sp = await searchParams;
  const status = one(sp.status) as InvoiceStatus | undefined;
  const from = one(sp.from);
  const to = one(sp.to);

  const now = new Date();
  const rows = await prisma.invoice.findMany({
    where: {
      ...(status ? { status } : {}),
      ...(from || to
        ? {
            issuedAt: {
              ...(from ? { gte: new Date(from) } : {}),
              ...(to ? { lte: new Date(`${to}T23:59:59Z`) } : {}),
            },
          }
        : {}),
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
        <h1 className="text-2xl font-semibold text-stone-900">Invoices</h1>
        <p className="text-sm text-stone-600">
          Raised automatically from challan on DRF Delivered.
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
            {Object.values(InvoiceStatus).map((s) => (
              <option key={s} value={s}>
                {s}
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
          <Link href="/admin/invoices">
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
              <TableHead>Invoice</TableHead>
              <TableHead>Clinic</TableHead>
              <TableHead>Amount</TableHead>
              <TableHead>Due</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Paid</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-stone-500">
                  No invoices.
                </TableCell>
              </TableRow>
            )}
            {rows.map((r) => {
              const overdue =
                (r.status === "RAISED" || r.status === "PAID_PARTIAL") &&
                r.dueDate < now;
              return (
                <TableRow
                  key={r.id}
                  className={cn(overdue && "bg-red-50/70")}
                >
                  <TableCell className="font-medium">
                    {r.invoiceNumber}
                  </TableCell>
                  <TableCell>
                    {clinicMap.get(r.buyerId)?.clinicCode ??
                      r.buyerId.slice(0, 8)}
                  </TableCell>
                  <TableCell>₹{money(r.netPayable)}</TableCell>
                  <TableCell className="text-xs">
                    {r.dueDate.toISOString().slice(0, 10)}
                  </TableCell>
                  <TableCell>
                    {overdue ? "OVERDUE" : r.status}
                  </TableCell>
                  <TableCell className="text-xs">
                    {r.paidAt?.toISOString().slice(0, 10) ?? "—"}
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
