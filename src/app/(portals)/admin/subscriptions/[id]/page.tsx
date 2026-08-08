import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { SubscriptionActions } from "./subscription-actions";
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

type Params = Promise<{ id: string }>;

function money(v: { toString(): string }) {
  return Number(v.toString()).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export default async function SubscriptionDetailPage({
  params,
}: {
  params: Params;
}) {
  const session = await getSession();
  if (!session) redirect("/login");
  const perms = permissionsForRoles(session.roles);
  if (!permissionGranted(perms, "subscription.view")) {
    redirect("/admin/subscriptions");
  }

  const { id } = await params;
  const sub = await prisma.subscription.findUnique({
    where: { id },
    include: {
      invoices: { orderBy: { issuedAt: "desc" } },
    },
  });
  if (!sub) notFound();

  const customer =
    sub.subscriberType === "CLINIC"
      ? await prisma.clinic.findUnique({ where: { id: sub.subscriberId } })
      : await prisma.recipient.findUnique({ where: { id: sub.subscriberId } });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="text-sm text-stone-500">{sub.subscriptionNumber}</div>
          <h1 className="text-2xl font-semibold text-stone-900">
            {sub.type} · {sub.status}
          </h1>
          <p className="mt-1 text-sm text-stone-600">
            {sub.subscriberType === "CLINIC"
              ? (customer as { clinicCode?: string } | null)?.clinicCode
              : (customer as { recipientCode?: string } | null)?.recipientCode}{" "}
            · next bill {sub.nextBillingAt.toISOString().slice(0, 10)} · ₹
            {money(sub.totalAmount)} / {sub.frequency.toLowerCase()}
          </p>
        </div>
        <SubscriptionActions
          id={sub.id}
          status={sub.status}
          canModify={permissionGranted(perms, "subscription.modify")}
          canCancel={permissionGranted(perms, "subscription.cancel")}
        />
      </div>

      <section className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-stone-200 bg-white p-4">
          <div className="text-xs text-stone-500">Unit amount</div>
          <div className="text-lg font-semibold">₹{money(sub.unitAmount)}</div>
        </div>
        <div className="rounded-xl border border-stone-200 bg-white p-4">
          <div className="text-xs text-stone-500">GST</div>
          <div className="text-lg font-semibold">₹{money(sub.gstAmount)}</div>
        </div>
        <div className="rounded-xl border border-stone-200 bg-white p-4">
          <div className="text-xs text-stone-500">Total / cycle</div>
          <div className="text-lg font-semibold">₹{money(sub.totalAmount)}</div>
        </div>
      </section>

      <section className="rounded-xl border border-stone-200 bg-white">
        <div className="border-b border-stone-100 px-4 py-3 text-sm font-semibold">
          Billing history
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Invoice</TableHead>
              <TableHead>Issued</TableHead>
              <TableHead>Amount</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sub.invoices.length === 0 && (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-stone-500">
                  No invoices generated yet.
                </TableCell>
              </TableRow>
            )}
            {sub.invoices.map((inv) => (
              <TableRow key={inv.id}>
                <TableCell>
                  <Link
                    href={`/admin/invoices/${inv.id}`}
                    className="text-emerald-900 hover:underline"
                  >
                    {inv.invoiceNumber}
                  </Link>
                </TableCell>
                <TableCell className="text-xs">
                  {inv.issuedAt.toISOString().slice(0, 10)}
                </TableCell>
                <TableCell>₹{money(inv.netPayable)}</TableCell>
                <TableCell>{inv.status}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </section>
    </div>
  );
}
