import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { DispatchActions } from "./dispatch-actions";
import { prisma } from "@/lib/db";
import {
  getSession,
  permissionGranted,
  permissionsForRoles,
} from "@/lib/rbac";

type Params = Promise<{ id: string }>;

export default async function DispatchDetailPage({
  params,
}: {
  params: Params;
}) {
  const session = await getSession();
  if (!session) redirect("/login");
  const perms = permissionsForRoles(session.roles);
  if (!permissionGranted(perms, "dispatch.view")) redirect("/admin/dispatches");

  const { id } = await params;
  const dispatch = await prisma.dispatchOrder.findUnique({
    where: { id },
    include: { clinic: true, site: true, drf: true, challans: true },
  });
  if (!dispatch) notFound();

  const custody = Array.isArray(dispatch.chainOfCustodyLog)
    ? (dispatch.chainOfCustodyLog as Array<Record<string, unknown>>)
    : [];

  const witnesses = await prisma.user.findMany({
    where: {
      isActive: true,
      id: { not: session.userId },
      roles: {
        some: {
          role: {
            in: [
              "BANK_WITNESS",
              "BANK_DISPATCH_COORD",
              "BANK_LOGISTICS",
              "BANK_LAB_HEAD",
              "BANK_SUPER_ADMIN",
            ],
          },
        },
      },
    },
    select: { id: true, email: true },
    take: 50,
  });

  return (
    <div className="space-y-6">
      <div>
        <div className="text-sm text-stone-500">{dispatch.dispatchNumber}</div>
        <h1 className="text-2xl font-semibold text-stone-900">
          Dispatch · {dispatch.state}
        </h1>
        <p className="mt-1 text-sm text-stone-600">
          {dispatch.clinic.clinicCode} · {dispatch.site.code} · {dispatch.type}
          {dispatch.drf && (
            <>
              {" · "}
              <Link
                href={`/admin/drfs/${dispatch.drfId}`}
                className="text-emerald-900 hover:underline"
              >
                {dispatch.drf.drfNumber}
              </Link>
            </>
          )}
        </p>
      </div>

      <section className="rounded-xl border border-stone-200 bg-white p-4 text-sm">
        <h2 className="mb-2 font-semibold">Chain of custody</h2>
        {custody.length === 0 ? (
          <p className="text-stone-500">No custody events yet.</p>
        ) : (
          <ul className="space-y-1 text-xs text-stone-700">
            {custody.map((e, i) => (
              <li key={i}>
                {String(e.at ?? "")} · {String(e.action ?? "")}
                {e.witnessUserId
                  ? ` · witness ${String(e.witnessUserId).slice(0, 8)}…`
                  : ""}
                {e.note ? ` — ${String(e.note)}` : ""}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-xl border border-stone-200 bg-white p-4 text-sm">
        <h2 className="mb-2 font-semibold">Vials</h2>
        <p>{dispatch.vialIds.length} vial(s) on this order</p>
        <ul className="mt-1 font-mono text-xs text-stone-600">
          {dispatch.vialIds.map((v) => (
            <li key={v}>{v}</li>
          ))}
        </ul>
      </section>

      <DispatchActions
        dispatchId={dispatch.id}
        state={dispatch.state}
        courierVendor={dispatch.courierVendor}
        courierTrackingId={dispatch.courierTrackingId}
        witnesses={witnesses}
        canUpdate={permissionGranted(perms, "dispatch.update")}
        canDeliver={permissionGranted(perms, "drf.deliver")}
      />
    </div>
  );
}
