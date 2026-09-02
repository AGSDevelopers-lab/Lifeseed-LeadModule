import Link from "next/link";
import { redirect } from "next/navigation";

import { prisma } from "@/lib/db";
import {
  getSession,
  permissionGranted,
  permissionsForRoles,
} from "@/lib/rbac";

export default async function CounsellorSessionsPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (
    !permissionGranted(
      permissionsForRoles(session.roles),
      "counsellor.sessions",
    )
  ) {
    redirect("/counsellor/dashboard");
  }

  const rows = await prisma.counsellingBooking.findMany({
    where: { counsellorUserId: session.userId },
    include: { lead: { select: { leadCode: true, city: true } } },
    orderBy: { scheduledAt: "desc" },
    take: 50,
  });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Sessions</h1>
      <ul className="space-y-2 rounded-xl border border-stone-200 bg-white p-4">
        {rows.map((r) => (
          <li key={r.id}>
            <Link
              href={`/counsellor/sessions/${r.id}`}
              className="text-sm text-emerald-900 hover:underline"
            >
              {r.lead.leadCode} · {r.status} ·{" "}
              {r.scheduledAt.toISOString().slice(0, 16)}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
