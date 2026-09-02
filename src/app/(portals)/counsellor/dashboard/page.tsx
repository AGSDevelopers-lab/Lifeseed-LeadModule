import Link from "next/link";
import { redirect } from "next/navigation";
import { CounsellingBookingStatus } from "@prisma/client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/primitives";
import { prisma } from "@/lib/db";
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

  const start = new Date();
  start.setUTCHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 1);
  const weekEnd = new Date(start);
  weekEnd.setUTCDate(weekEnd.getUTCDate() + 7);

  const [today, upcoming, attended, noShow] = await Promise.all([
    prisma.counsellingBooking.findMany({
      where: {
        counsellorUserId: session.userId,
        scheduledAt: { gte: start, lt: end },
        status: CounsellingBookingStatus.BOOKED,
      },
      include: { lead: { select: { leadCode: true, fullName: true, city: true } } },
      orderBy: { scheduledAt: "asc" },
    }),
    prisma.counsellingBooking.findMany({
      where: {
        counsellorUserId: session.userId,
        scheduledAt: { gte: end, lt: weekEnd },
        status: CounsellingBookingStatus.BOOKED,
      },
      include: { lead: { select: { leadCode: true } } },
      orderBy: { scheduledAt: "asc" },
      take: 20,
    }),
    prisma.counsellingBooking.count({
      where: {
        counsellorUserId: session.userId,
        status: CounsellingBookingStatus.ATTENDED,
      },
    }),
    prisma.counsellingBooking.count({
      where: {
        counsellorUserId: session.userId,
        status: CounsellingBookingStatus.NO_SHOW,
      },
    }),
  ]);

  const total = attended + noShow;
  const noShowRate = total === 0 ? null : Math.round((noShow / total) * 100);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Counsellor dashboard</h1>
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm text-stone-500">Today</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">
            {today.length}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm text-stone-500">This week</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">
            {upcoming.length}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm text-stone-500">No-show rate</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">
            {noShowRate == null ? "—" : `${noShowRate}%`}
          </CardContent>
        </Card>
      </div>

      <div>
        <h2 className="mb-2 font-semibold">Today&apos;s sessions</h2>
        <ul className="space-y-2">
          {today.length === 0 && (
            <li className="text-sm text-stone-500">No sessions today</li>
          )}
          {today.map((s) => (
            <li key={s.id}>
              <Link
                href={`/counsellor/sessions/${s.id}`}
                className="text-sm text-emerald-900 hover:underline"
              >
                {s.scheduledAt.toISOString().slice(11, 16)} UTC ·{" "}
                {s.lead.leadCode} · {s.lead.fullName ?? "—"}
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
