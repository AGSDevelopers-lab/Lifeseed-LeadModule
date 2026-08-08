import Link from "next/link";
import { redirect } from "next/navigation";
import {
  SubscriptionStatus,
  SubscriptionType,
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

function mrrOf(sub: {
  frequency: string;
  totalAmount: { toString(): string };
}): number {
  const amt = Number(sub.totalAmount.toString());
  if (sub.frequency === "MONTHLY") return amt;
  if (sub.frequency === "QUARTERLY") return amt / 3;
  return amt / 12;
}

export default async function SubscriptionsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const session = await getSession();
  if (!session) redirect("/login");
  if (
    !permissionGranted(
      permissionsForRoles(session.roles),
      "subscription.view",
    )
  ) {
    redirect("/admin");
  }

  const sp = await searchParams;
  const type = one(sp.type) as SubscriptionType | undefined;
  const status = one(sp.status) as SubscriptionStatus | undefined;
  const clinicId = one(sp.clinic);

  const rows = await prisma.subscription.findMany({
    where: {
      ...(type ? { type } : {}),
      ...(status ? { status } : {}),
      ...(clinicId
        ? { subscriberType: "CLINIC", subscriberId: clinicId }
        : {}),
    },
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  const clinicIds = rows
    .filter((r) => r.subscriberType === "CLINIC")
    .map((r) => r.subscriberId);
  const clinics = await prisma.clinic.findMany({
    where: { id: { in: clinicIds } },
  });
  const clinicMap = new Map(clinics.map((c) => [c.id, c]));
  const allClinics = await prisma.clinic.findMany({
    orderBy: { clinicCode: "asc" },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-stone-900">
            Subscriptions
          </h1>
          <p className="text-sm text-stone-600">
            Cryostorage + membership recurring billing.
          </p>
        </div>
        {permissionGranted(
          permissionsForRoles(session.roles),
          "subscription.create",
        ) && (
          <Link href="/admin/subscriptions/new">
            <Button>New subscription</Button>
          </Link>
        )}
      </div>

      <form
        method="get"
        className="flex flex-wrap gap-3 rounded-xl border border-stone-200 bg-white p-4"
      >
        <label className="flex flex-col gap-1 text-xs font-medium text-stone-600">
          Type
          <select
            name="type"
            defaultValue={type ?? ""}
            className="h-10 rounded-md border border-stone-300 px-2 text-sm"
          >
            <option value="">All</option>
            {Object.values(SubscriptionType).map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium text-stone-600">
          Status
          <select
            name="status"
            defaultValue={status ?? ""}
            className="h-10 rounded-md border border-stone-300 px-2 text-sm"
          >
            <option value="">All</option>
            {Object.values(SubscriptionStatus).map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium text-stone-600">
          Clinic
          <select
            name="clinic"
            defaultValue={clinicId ?? ""}
            className="h-10 rounded-md border border-stone-300 px-2 text-sm"
          >
            <option value="">All</option>
            {allClinics.map((c) => (
              <option key={c.id} value={c.id}>
                {c.clinicCode}
              </option>
            ))}
          </select>
        </label>
        <div className="flex items-end gap-2">
          <Button type="submit">Apply</Button>
          <Link href="/admin/subscriptions">
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
              <TableHead>Subscription</TableHead>
              <TableHead>Customer</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Next bill</TableHead>
              <TableHead>MRR</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-stone-500">
                  No subscriptions.
                </TableCell>
              </TableRow>
            )}
            {rows.map((r) => (
              <TableRow key={r.id}>
                <TableCell>
                  <Link
                    href={`/admin/subscriptions/${r.id}`}
                    className="font-medium text-emerald-900 hover:underline"
                  >
                    {r.subscriptionNumber}
                  </Link>
                </TableCell>
                <TableCell>
                  {r.subscriberType === "CLINIC"
                    ? (clinicMap.get(r.subscriberId)?.clinicCode ??
                      r.subscriberId.slice(0, 8))
                    : `Recipient ${r.subscriberId.slice(0, 8)}`}
                </TableCell>
                <TableCell className="text-xs">{r.type}</TableCell>
                <TableCell>{r.status}</TableCell>
                <TableCell className="text-xs">
                  {r.nextBillingAt.toISOString().slice(0, 10)}
                </TableCell>
                <TableCell>₹{money({ toString: () => String(mrrOf(r)) })}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
