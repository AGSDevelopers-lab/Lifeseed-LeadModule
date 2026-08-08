import Link from "next/link";
import { redirect } from "next/navigation";
import { InvoiceStatus, SubscriptionStatus } from "@prisma/client";
import { Decimal } from "@prisma/client/runtime/library";

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

function money(n: number | Decimal) {
  const v = typeof n === "number" ? n : Number(n.toString());
  return v.toLocaleString("en-IN", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
}

export default async function FinanceDashboardPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (
    !permissionGranted(
      permissionsForRoles(session.roles),
      "finance.dashboard",
    )
  ) {
    redirect("/admin");
  }

  const now = new Date();
  const [
    activeSubs,
    openInvoices,
    payments,
    overdueInvoices,
  ] = await Promise.all([
    prisma.subscription.findMany({
      where: { status: SubscriptionStatus.ACTIVE },
    }),
    prisma.invoice.findMany({
      where: {
        status: {
          in: [
            InvoiceStatus.RAISED,
            InvoiceStatus.PAID_PARTIAL,
            InvoiceStatus.OVERDUE,
          ],
        },
      },
      include: { payments: true, creditNotes: true },
    }),
    prisma.payment.findMany({
      where: {
        paidAt: {
          gte: new Date(now.getUTCFullYear(), now.getUTCMonth() - 5, 1),
        },
      },
      select: { amount: true, paidAt: true },
    }),
    prisma.invoice.findMany({
      where: {
        dueDate: { lt: now },
        status: {
          in: [
            InvoiceStatus.RAISED,
            InvoiceStatus.PAID_PARTIAL,
            InvoiceStatus.OVERDUE,
          ],
        },
      },
      orderBy: { dueDate: "asc" },
      take: 10,
    }),
  ]);

  let mrr = 0;
  for (const s of activeSubs) {
    const amt = Number(s.totalAmount.toString());
    if (s.frequency === "MONTHLY") mrr += amt;
    else if (s.frequency === "QUARTERLY") mrr += amt / 3;
    else mrr += amt / 12;
  }
  const arr = mrr * 12;

  let outstanding = 0;
  let weightedDays = 0;
  let outstandingForDso = 0;
  const aging = { b0: 0, b30: 0, b60: 0, b90: 0 };

  for (const inv of openInvoices) {
    const paid = inv.payments.reduce(
      (s, p) => s.add(p.amount),
      new Decimal(0),
    );
    const credited = inv.creditNotes.reduce(
      (s, c) => s.add(c.amount),
      new Decimal(0),
    );
    const bal = Number(
      new Decimal(inv.netPayable).sub(paid).sub(credited).toString(),
    );
    if (bal <= 0) continue;
    outstanding += bal;
    const days = Math.floor(
      (now.getTime() - inv.issuedAt.getTime()) / (86400 * 1000),
    );
    weightedDays += days * bal;
    outstandingForDso += bal;

    const overdueDays = Math.floor(
      (now.getTime() - inv.dueDate.getTime()) / (86400 * 1000),
    );
    if (overdueDays <= 30) aging.b0 += bal;
    else if (overdueDays <= 60) aging.b30 += bal;
    else if (overdueDays <= 90) aging.b60 += bal;
    else aging.b90 += bal;
  }

  const dso =
    outstandingForDso > 0 ? Math.round(weightedDays / outstandingForDso) : 0;

  // Monthly revenue trend (last 6 months)
  const months: Array<{ key: string; label: string; total: number }> = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getUTCFullYear(), now.getUTCMonth() - i, 1);
    const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
    months.push({
      key,
      label: d.toLocaleString("en-IN", { month: "short", year: "2-digit" }),
      total: 0,
    });
  }
  for (const p of payments) {
    const key = `${p.paidAt.getUTCFullYear()}-${String(p.paidAt.getUTCMonth() + 1).padStart(2, "0")}`;
    const m = months.find((x) => x.key === key);
    if (m) m.total += Number(p.amount.toString());
  }
  const maxMonth = Math.max(...months.map((m) => m.total), 1);

  const clinics = await prisma.clinic.findMany({
    where: { id: { in: overdueInvoices.map((i) => i.buyerId) } },
  });
  const clinicMap = new Map(clinics.map((c) => [c.id, c]));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-stone-900">
          Finance dashboard
        </h1>
        <p className="text-sm text-stone-600">
          MRR / ARR · DSO · AR aging · collections trend.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <Kpi label="MRR" value={`₹${money(mrr)}`} />
        <Kpi label="ARR" value={`₹${money(arr)}`} />
        <Kpi label="DSO (days)" value={String(dso)} />
        <Kpi label="Outstanding" value={`₹${money(outstanding)}`} />
        <Kpi
          label="Overdue 90+"
          value={`₹${money(aging.b90)}`}
          tone="warn"
        />
      </div>

      <section className="rounded-xl border border-stone-200 bg-white p-4">
        <h2 className="mb-3 text-sm font-semibold">AR aging</h2>
        <div className="grid gap-3 sm:grid-cols-4 text-sm">
          <Aging label="0–30d" amount={aging.b0} />
          <Aging label="30–60d" amount={aging.b30} />
          <Aging label="60–90d" amount={aging.b60} />
          <Aging label="90d+" amount={aging.b90} warn />
        </div>
      </section>

      <section className="rounded-xl border border-stone-200 bg-white p-4">
        <h2 className="mb-4 text-sm font-semibold">
          Monthly collections (₹)
        </h2>
        <div className="flex h-40 items-end gap-3">
          {months.map((m) => (
            <div key={m.key} className="flex flex-1 flex-col items-center gap-1">
              <div
                className="w-full rounded-t bg-emerald-700/80"
                style={{
                  height: `${Math.max(4, (m.total / maxMonth) * 100)}%`,
                }}
                title={`₹${money(m.total)}`}
              />
              <div className="text-[10px] text-stone-500">{m.label}</div>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-xl border border-stone-200 bg-white">
        <div className="border-b border-stone-100 px-4 py-3 text-sm font-semibold">
          Top 10 overdue invoices
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Invoice</TableHead>
              <TableHead>Clinic</TableHead>
              <TableHead>Due</TableHead>
              <TableHead>Amount</TableHead>
              <TableHead>Dunning</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {overdueInvoices.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-stone-500">
                  No overdue invoices.
                </TableCell>
              </TableRow>
            )}
            {overdueInvoices.map((r) => (
              <TableRow key={r.id} className="bg-red-50/40">
                <TableCell>
                  <Link
                    href={`/admin/invoices/${r.id}`}
                    className="text-emerald-900 hover:underline"
                  >
                    {r.invoiceNumber}
                  </Link>
                </TableCell>
                <TableCell>
                  {clinicMap.get(r.buyerId)?.clinicCode ?? "—"}
                </TableCell>
                <TableCell className="text-xs">
                  {r.dueDate.toISOString().slice(0, 10)}
                </TableCell>
                <TableCell>₹{money(r.netPayable)}</TableCell>
                <TableCell className="text-xs">{r.dunningStage}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </section>
    </div>
  );
}

function Kpi({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "warn";
}) {
  return (
    <div
      className={cn(
        "rounded-xl border bg-white p-4",
        tone === "warn" ? "border-amber-200" : "border-stone-200",
      )}
    >
      <div className="text-xs uppercase tracking-wide text-stone-500">
        {label}
      </div>
      <div className="mt-1 text-xl font-semibold text-stone-900">{value}</div>
    </div>
  );
}

function Aging({
  label,
  amount,
  warn,
}: {
  label: string;
  amount: number;
  warn?: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-lg px-3 py-2 ring-1",
        warn
          ? "bg-red-50 ring-red-200"
          : "bg-stone-50 ring-stone-200",
      )}
    >
      <div className="text-xs text-stone-500">{label}</div>
      <div className="font-semibold">₹{money(amount)}</div>
    </div>
  );
}
