import Link from "next/link";
import { redirect } from "next/navigation";
import { LeadStatus } from "@prisma/client";

import { Button, Card, CardContent, CardHeader, CardTitle } from "@/components/ui/primitives";
import { prisma } from "@/lib/db";
import {
  getSession,
  permissionGranted,
  permissionsForRoles,
} from "@/lib/rbac";

export default async function TelecallerDashboardPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (
    !permissionGranted(
      permissionsForRoles(session.roles),
      "telecaller.dashboard",
    )
  ) {
    redirect("/portal");
  }

  const startOfDay = new Date();
  startOfDay.setUTCHours(0, 0, 0, 0);
  const in2h = new Date(Date.now() + 2 * 3600_000);

  const [open, breaching, convertedToday, calledToday, durations] =
    await Promise.all([
      prisma.lead.count({
        where: {
          assignedTelecallerId: session.userId,
          status: {
            in: [
              LeadStatus.ASSIGNED,
              LeadStatus.CONTACTED_CALLBACK_REQUESTED,
              LeadStatus.NOT_REACHABLE,
              LeadStatus.NEW,
            ],
          },
        },
      }),
      prisma.lead.count({
        where: {
          assignedTelecallerId: session.userId,
          slaResponseDueAt: { lte: in2h },
          status: {
            notIn: [
              LeadStatus.CONVERTED,
              LeadStatus.LOST,
              LeadStatus.EXPIRED_AUTO_PURGED,
              LeadStatus.DO_NOT_CALL,
            ],
          },
        },
      }),
      prisma.lead.count({
        where: {
          convertedByUserId: session.userId,
          convertedAt: { gte: startOfDay },
        },
      }),
      prisma.callDisposition.count({
        where: {
          telecallerId: session.userId,
          createdAt: { gte: startOfDay },
        },
      }),
      prisma.callDisposition.findMany({
        where: {
          telecallerId: session.userId,
          createdAt: { gte: startOfDay },
          durationSeconds: { not: null },
        },
        select: { durationSeconds: true },
      }),
    ]);

  const avgDuration =
    durations.length === 0
      ? 0
      : Math.round(
          durations.reduce((s, d) => s + (d.durationSeconds ?? 0), 0) /
            durations.length,
        );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Telecaller dashboard</h1>
          <p className="text-sm text-stone-600">Your queue and today&apos;s activity</p>
        </div>
        <Link href="/telecaller/leads/new">
          <Button>Add lead from call</Button>
        </Link>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {[
          ["My open leads", open],
          ["SLA due ≤2h", breaching],
          ["Converted today", convertedToday],
          ["Calls today", calledToday],
          ["Avg call (sec)", avgDuration],
        ].map(([label, value]) => (
          <Card key={String(label)}>
            <CardHeader>
              <CardTitle className="text-sm font-medium text-stone-500">
                {label}
              </CardTitle>
            </CardHeader>
            <CardContent className="text-2xl font-semibold">{value}</CardContent>
          </Card>
        ))}
      </div>
      <Link href="/telecaller/queue" className="text-sm text-emerald-900 hover:underline">
        Open my queue →
      </Link>
    </div>
  );
}
