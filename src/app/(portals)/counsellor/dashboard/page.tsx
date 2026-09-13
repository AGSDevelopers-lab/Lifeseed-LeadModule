import Link from "next/link";
import { redirect } from "next/navigation";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/primitives";
import { listCounsellorWorkspace } from "@/lib/leads/adapters/prisma-counselling";
import { isLeadCounsellingHistoryEnabled } from "@/lib/leads/application/feature-flag";
import {
  getSession,
  permissionGranted,
  permissionsForRoles,
} from "@/lib/rbac";

export default async function CounsellorDashboardPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (
    !permissionGranted(
      permissionsForRoles(session.roles),
      "counsellor.dashboard",
    )
  ) {
    redirect("/portal");
  }

  const historyOn = isLeadCounsellingHistoryEnabled();
  const { today, upcoming, closedAttended, closedNoShow } =
    await listCounsellorWorkspace(session.userId);
  const total = closedAttended + closedNoShow;
  const noShowRate = total === 0 ? null : Math.round((closedNoShow / total) * 100);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Counsellor dashboard</h1>
      {historyOn ? (
        <p className="text-sm text-stone-600">
          <Link href="/counsellor/calendar" className="text-emerald-800 underline">
            Calendar
          </Link>
          {" · "}
          <Link href="/counsellor/sessions" className="text-emerald-800 underline">
            Session history
          </Link>
        </p>
      ) : (
        <p className="text-sm text-stone-500">Legacy single-booking workspace (history flag off).</p>
      )}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm text-stone-500">Today</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">{today.length}</CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm text-stone-500">No-show rate</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">
            {noShowRate == null ? "—" : `${noShowRate}%`}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm text-stone-500">Upcoming</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">{upcoming.length}</CardContent>
        </Card>
      </div>
      <ul className="space-y-2 rounded-xl border border-stone-200 bg-white p-4">
        {today.map((r) => (
          <li key={r.id}>
            <Link
              href={`/counsellor/sessions/${r.id}`}
              className="text-sm text-emerald-900 hover:underline"
            >
              {r.lead.leadCode} · {r.lead.fullName} · {r.scheduledAt.toISOString().slice(11, 16)} UTC
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
