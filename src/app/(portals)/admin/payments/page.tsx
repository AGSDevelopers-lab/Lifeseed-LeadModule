import Link from "next/link";
import { redirect } from "next/navigation";
import { PaymentMethod } from "@prisma/client";

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

export default async function PaymentsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const session = await getSession();
  if (!session) redirect("/login");
  if (
    !permissionGranted(permissionsForRoles(session.roles), "payment.list")
  ) {
    redirect("/admin");
  }

  const sp = await searchParams;
  const method = one(sp.method) as PaymentMethod | undefined;
  const gateway = one(sp.gateway);
  const from = one(sp.from);
  const to = one(sp.to);

  const rows = await prisma.payment.findMany({
    where: {
      ...(method ? { method } : {}),
      ...(gateway
        ? { gateway: { contains: gateway, mode: "insensitive" } }
        : {}),
      ...(from || to
        ? {
            paidAt: {
              ...(from ? { gte: new Date(from) } : {}),
              ...(to ? { lte: new Date(`${to}T23:59:59Z`) } : {}),
            },
          }
        : {}),
    },
    include: { invoice: true },
    orderBy: { paidAt: "desc" },
    take: 300,
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-stone-900">Payments</h1>
        <p className="text-sm text-stone-600">
          Gateway + manual collections · reconciliation stub below.
        </p>
      </div>

      <form
        method="get"
        className="flex flex-wrap gap-3 rounded-xl border border-stone-200 bg-white p-4"
      >
        <label className="flex flex-col gap-1 text-xs font-medium text-stone-600">
          Method
          <select
            name="method"
            defaultValue={method ?? ""}
            className="h-10 rounded-md border border-stone-300 px-2 text-sm"
          >
            <option value="">All</option>
            {Object.values(PaymentMethod).map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium text-stone-600">
          Gateway
          <input
            name="gateway"
            defaultValue={gateway ?? ""}
            className="h-10 rounded-md border border-stone-300 px-2 text-sm"
            placeholder="RAZORPAY / PAYU"
          />
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
          <Link href="/admin/payments">
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
              <TableHead>Payment</TableHead>
              <TableHead>Invoice</TableHead>
              <TableHead>Method</TableHead>
              <TableHead>Gateway txn</TableHead>
              <TableHead>Amount</TableHead>
              <TableHead>Paid at</TableHead>
              <TableHead>Reconciled</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-stone-500">
                  No payments.
                </TableCell>
              </TableRow>
            )}
            {rows.map((r) => (
              <TableRow key={r.id}>
                <TableCell className="font-mono text-xs">
                  {r.paymentNumber}
                </TableCell>
                <TableCell>
                  <Link
                    href={`/admin/invoices/${r.invoiceId}`}
                    className="text-emerald-900 hover:underline"
                  >
                    {r.invoice.invoiceNumber}
                  </Link>
                </TableCell>
                <TableCell>{r.method}</TableCell>
                <TableCell className="font-mono text-xs">
                  {r.gatewayTxnId ?? "—"}
                </TableCell>
                <TableCell>₹{money(r.amount)}</TableCell>
                <TableCell className="text-xs">
                  {r.paidAt.toISOString().slice(0, 10)}
                </TableCell>
                <TableCell className="text-xs">
                  {r.reconciledAt
                    ? r.reconciliationLevel ?? "Yes"
                    : "Pending"}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <section className="rounded-xl border border-dashed border-stone-300 bg-stone-50 p-4 text-sm">
        <h2 className="font-semibold text-stone-900">
          Reconciliation · bank statement CSV (stub)
        </h2>
        <p className="mt-1 text-stone-600">
          Upload MT940 / CSV to match gateway payments vs bank credits. Level-1
          strict / Level-2 soft matching will land in a later sprint — this
          control is UI-only for now.
        </p>
        <input
          type="file"
          accept=".csv,.txt"
          disabled
          className="mt-3 block text-xs text-stone-500"
        />
      </section>
    </div>
  );
}
