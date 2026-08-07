import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { DrfDetailActions } from "./drf-detail-actions";
import { prisma } from "@/lib/db";
import { DRF_STATE_LABEL } from "@/lib/drf-state";
import {
  getSession,
  permissionGranted,
  permissionsForRoles,
} from "@/lib/rbac";
import { cn } from "@/lib/utils";

type Params = Promise<{ id: string }>;

const TIMELINE_ORDER = [
  "DRAFT",
  "SUBMITTED",
  "ACCEPTED",
  "ALLOCATED",
  "IN_TRANSIT",
  "DELIVERED",
  "IN_CYCLE",
  "OUTCOME_PENDING",
  "CLOSED",
] as const;

export default async function DrfDetailPage({ params }: { params: Params }) {
  const session = await getSession();
  if (!session) redirect("/login");
  const perms = permissionsForRoles(session.roles);
  if (!permissionGranted(perms, "drf.view")) redirect("/admin/drfs");

  const { id } = await params;
  const drf = await prisma.dRF.findUnique({
    where: { id },
    include: {
      clinic: true,
      site: true,
      recipient: true,
      dispatches: { orderBy: { createdAt: "desc" } },
      challans: { include: { invoice: true }, orderBy: { issuedAt: "desc" } },
      invoices: true,
    },
  });
  if (!drf) notFound();

  const events = await prisma.auditLog.findMany({
    where: { entityType: "DRF", entityId: drf.id },
    orderBy: { timestamp: "asc" },
    take: 50,
  });

  const witnesses = await prisma.user.findMany({
    where: {
      isActive: true,
      id: { not: session.userId },
      roles: {
        some: {
          role: {
            in: [
              "BANK_WITNESS",
              "BANK_CRYOBANK_TECH",
              "BANK_LAB_HEAD",
              "BANK_DISPATCH_COORD",
              "BANK_LOGISTICS",
              "BANK_SUPER_ADMIN",
            ],
          },
        },
      },
    },
    select: { id: true, email: true },
    take: 50,
  });

  const stateIdx = TIMELINE_ORDER.indexOf(
    drf.state as (typeof TIMELINE_ORDER)[number],
  );

  return (
    <div className="space-y-6">
      <div>
        <div className="text-sm text-stone-500">{drf.drfNumber}</div>
        <h1 className="text-2xl font-semibold text-stone-900">
          DRF · {drf.clinic.name}
        </h1>
        <div className="mt-2 flex flex-wrap gap-2 text-xs">
          <Pill>{DRF_STATE_LABEL[drf.state]}</Pill>
          <Pill tone={drf.priority === "URGENT" ? "warn" : "neutral"}>
            {drf.priority}
          </Pill>
          <Pill>{drf.type}</Pill>
          <Link
            href={`/admin/drfs?clinic=${drf.clinicId}`}
            className="text-emerald-900 hover:underline"
          >
            {drf.clinic.clinicCode}
          </Link>
          <span className="text-stone-600">→ {drf.site.code}</span>
        </div>
      </div>

      <section className="rounded-xl border border-stone-200 bg-white p-4">
        <h2 className="mb-3 text-sm font-semibold text-stone-900">Timeline</h2>
        <ol className="flex flex-wrap gap-2">
          {TIMELINE_ORDER.map((s, i) => (
            <li
              key={s}
              className={cn(
                "rounded-full px-2.5 py-1 text-xs ring-1",
                drf.state === "CANCELLED"
                  ? "bg-stone-50 text-stone-400 ring-stone-200"
                  : i <= stateIdx
                    ? "bg-emerald-50 text-emerald-900 ring-emerald-200"
                    : "bg-stone-50 text-stone-400 ring-stone-200",
              )}
            >
              {DRF_STATE_LABEL[s]}
            </li>
          ))}
          {drf.state === "CANCELLED" && (
            <li className="rounded-full bg-red-50 px-2.5 py-1 text-xs text-red-800 ring-1 ring-red-200">
              Cancelled
            </li>
          )}
        </ol>
        <ul className="mt-4 space-y-1 text-xs text-stone-600">
          {events.map((e) => (
            <li key={e.id}>
              {e.timestamp.toISOString()} · {e.action}
              {typeof e.afterJson === "object" &&
              e.afterJson &&
              "event" in e.afterJson
                ? ` · ${(e.afterJson as { event?: string }).event ?? ""}`
                : ""}
            </li>
          ))}
          {events.length === 0 && <li>No transition events yet.</li>}
        </ul>
      </section>

      <section className="grid gap-4 sm:grid-cols-2">
        <Dl
          title="Request"
          rows={[
            ["Quantity", String(drf.requestedQuantity)],
            ["Category filter", drf.filterCategory ?? "—"],
            ["Grade filter", drf.filterGrade ?? "—"],
            ["Notes", drf.notes ?? "—"],
            [
              "Expected delivery",
              drf.expectedDeliveryAt?.toISOString().slice(0, 10) ?? "—",
            ],
          ]}
        />
        <Dl
          title="Allocation / logistics"
          rows={[
            [
              "Assigned vials",
              Array.isArray(drf.assignedVialIds)
                ? String((drf.assignedVialIds as string[]).length)
                : "—",
            ],
            ["Allocated at", drf.allocatedAt?.toISOString() ?? "—"],
            ["Dispatched at", drf.dispatchedAt?.toISOString() ?? "—"],
            ["Delivered at", drf.deliveredAt?.toISOString() ?? "—"],
            ["Outcome", drf.outcomeType ?? "—"],
          ]}
        />
      </section>

      {drf.dispatches.length > 0 && (
        <section className="rounded-xl border border-stone-200 bg-white p-4 text-sm">
          <h2 className="mb-2 font-semibold">Dispatches</h2>
          <ul className="space-y-1">
            {drf.dispatches.map((d) => (
              <li key={d.id}>
                <Link
                  href={`/admin/dispatches/${d.id}`}
                  className="text-emerald-900 hover:underline"
                >
                  {d.dispatchNumber}
                </Link>{" "}
                · {d.state}
                {d.courierTrackingId ? ` · ${d.courierTrackingId}` : ""}
              </li>
            ))}
          </ul>
        </section>
      )}

      {(drf.challans.length > 0 || drf.invoices.length > 0) && (
        <section className="rounded-xl border border-stone-200 bg-white p-4 text-sm">
          <h2 className="mb-2 font-semibold">Billing</h2>
          <ul className="space-y-1">
            {drf.challans.map((c) => (
              <li key={c.id}>
                Challan {c.challanNumber} · {c.status}
                {c.invoice ? ` → Invoice ${c.invoice.invoiceNumber}` : ""}
              </li>
            ))}
          </ul>
        </section>
      )}

      <DrfDetailActions
        drfId={drf.id}
        state={drf.state}
        witnesses={witnesses}
        canAccept={permissionGranted(perms, "drf.accept")}
        canAllocate={permissionGranted(perms, "drf.allocate")}
        canDispatch={permissionGranted(perms, "drf.dispatch")}
        canDeliver={permissionGranted(perms, "drf.deliver")}
        canCancel={permissionGranted(perms, "drf.cancel")}
      />
    </div>
  );
}

function Pill({
  children,
  tone = "neutral",
}: {
  children: React.ReactNode;
  tone?: "neutral" | "warn";
}) {
  return (
    <span
      className={cn(
        "rounded-full px-2.5 py-0.5 ring-1",
        tone === "warn"
          ? "bg-amber-50 text-amber-900 ring-amber-200"
          : "bg-stone-100 text-stone-800 ring-stone-200",
      )}
    >
      {children}
    </span>
  );
}

function Dl({
  title,
  rows,
}: {
  title: string;
  rows: Array<[string, string]>;
}) {
  return (
    <div className="rounded-xl border border-stone-200 bg-white p-4 text-sm">
      <h2 className="mb-3 font-semibold text-stone-900">{title}</h2>
      <dl className="grid gap-2">
        {rows.map(([k, v]) => (
          <div key={k}>
            <dt className="text-xs uppercase tracking-wide text-stone-500">
              {k}
            </dt>
            <dd>{v}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
