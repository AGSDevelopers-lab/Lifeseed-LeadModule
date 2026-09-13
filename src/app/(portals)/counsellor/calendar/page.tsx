import Link from "next/link";
import { redirect } from "next/navigation";

import { listCounsellorWorkspace } from "@/lib/leads/adapters/prisma-counselling";
import { isLeadCounsellingHistoryEnabled } from "@/lib/leads/application/feature-flag";
import {
  getSession,
  permissionGranted,
  permissionsForRoles,
} from "@/lib/rbac";

export default async function CounsellorCalendarPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (
    !permissionGranted(permissionsForRoles(session.roles), "counselling.view") &&
    !permissionGranted(permissionsForRoles(session.roles), "counsellor.dashboard")
  ) {
    redirect("/counsellor/dashboard");
  }
  if (!isLeadCounsellingHistoryEnabled()) {
    redirect("/counsellor/dashboard");
  }
  const week = await listCounsellorWorkspace(session.userId);
  const rows = [...week.today, ...week.upcoming];
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Counselling calendar</h1>
      <p className="text-sm text-stone-600">
        Authoritative bookings from the counselling domain (next 7 days).
      </p>
      <ul className="space-y-2 rounded-xl border border-stone-200 bg-white p-4">
        {rows.map((r) => (
          <li key={r.id}>
            <Link
              href={`/counsellor/sessions/${r.id}`}
              className="text-sm text-emerald-900 hover:underline"
            >
              {r.scheduledAt.toISOString().replace("T", " ").slice(0, 16)} UTC · {r.lead.leadCode} ·{" "}
              {r.bookingStatus}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
