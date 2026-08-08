import { redirect } from "next/navigation";
import { CycleOutcome, DrfState, NudgeStatus } from "@prisma/client";

import { TriggerNudgesButton } from "@/app/(portals)/admin/outcomes/trigger-nudges-button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/primitives";
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

export default async function AdminOutcomesPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!permissionGranted(permissionsForRoles(session.roles), "outcome.view")) {
    redirect("/admin");
  }

  const now = new Date();
  const weekEnd = new Date(now);
  weekEnd.setUTCDate(weekEnd.getUTCDate() + 7);
  const days90 = new Date(now);
  days90.setUTCDate(days90.getUTCDate() - 90);

  const [
    inProgress,
    closedWithOutcome,
    closedTotal,
    liveBirths,
    clinics,
    pendingNudges,
  ] = await Promise.all([
    prisma.dRF.count({
      where: {
        state: { in: [DrfState.IN_CYCLE, DrfState.OUTCOME_PENDING] },
      },
    }),
    prisma.embryoCohort.count({
      where: {
        outcome: { in: [CycleOutcome.PREGNANT, CycleOutcome.NOT_PREGNANT] },
        outcomeReportedAt: { gte: days90 },
      },
    }),
    prisma.embryoCohort.count({
      where: {
        closedAt: { gte: days90 },
      },
    }),
    prisma.embryoCohort.count({
      where: { outcome: CycleOutcome.PREGNANT, outcomeReportedAt: { gte: days90 } },
    }),
    prisma.clinic.findMany({
      select: {
        id: true,
        name: true,
        clinicCode: true,
        drfs: {
          where: {
            state: { in: [DrfState.IN_CYCLE, DrfState.OUTCOME_PENDING] },
          },
          select: { id: true },
        },
        _count: {
          select: {
            cycleEvents: true,
          },
        },
      },
      orderBy: { name: "asc" },
      take: 100,
    }),
    prisma.outcomeNudge.findMany({
      where: {
        status: NudgeStatus.PENDING,
        scheduledAt: { lte: weekEnd },
      },
      include: {
        drf: { select: { drfNumber: true, clinic: { select: { name: true } } } },
      },
      orderBy: { scheduledAt: "asc" },
      take: 50,
    }),
  ]);

  const feedbackRate =
    closedTotal > 0 ? Math.round((closedWithOutcome / closedTotal) * 100) : null;
  const liveBirthRate =
    closedWithOutcome > 0
      ? Math.round((liveBirths / closedWithOutcome) * 100)
      : null;

  // Per-clinic feedback stats (last 90d)
  const clinicStats = await Promise.all(
    clinics.map(async (c) => {
      const [closed90, reported90] = await Promise.all([
        prisma.embryoCohort.count({
          where: { clinicId: c.id, closedAt: { gte: days90 } },
        }),
        prisma.embryoCohort.count({
          where: {
            clinicId: c.id,
            outcomeReportedAt: { gte: days90 },
            outcome: {
              in: [
                CycleOutcome.PREGNANT,
                CycleOutcome.NOT_PREGNANT,
                CycleOutcome.CANCELLED,
              ],
            },
          },
        }),
      ]);
      const rate = closed90 > 0 ? Math.round((reported90 / closed90) * 100) : null;
      return {
        id: c.id,
        name: c.name,
        code: c.clinicCode,
        inProgress: c.drfs.length,
        feedbackRate: rate,
        outcomes90: reported90,
        compliance:
          rate == null ? "—" : rate >= 70 ? "OK" : rate >= 40 ? "Watch" : "Low",
      };
    }),
  );

  const transferredCohorts = await prisma.embryoCohort.findMany({
    where: {
      transferredCount: { gt: 0 },
      outcomeReportedAt: { not: null },
      startedAt: { gte: days90 },
    },
    select: { startedAt: true, outcomeReportedAt: true },
    take: 500,
  });
  const avgDays =
    transferredCohorts.length === 0
      ? null
      : Math.round(
          transferredCohorts.reduce((sum, c) => {
            const end = c.outcomeReportedAt!.getTime();
            return sum + (end - c.startedAt.getTime()) / (24 * 60 * 60 * 1000);
          }, 0) / transferredCohorts.length,
        );

  const canTrigger = permissionGranted(
    permissionsForRoles(session.roles),
    "outcome.trigger_nudges",
  );

  const todayIso = now.toISOString().slice(0, 10);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-stone-900">
            Cycle outcome monitor
          </h1>
          <p className="text-sm text-stone-600">
            Bank-side feedback tracking · nudges Day 14/30/90/180 (desired, not
            mandatory).
          </p>
        </div>
        {canTrigger && <TriggerNudgesButton />}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-stone-500">
              Cycles in progress
            </CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">{inProgress}</CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-stone-500">
              Feedback rate (90d)
            </CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">
            {feedbackRate == null ? "—" : `${feedbackRate}%`}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-stone-500">
              Avg days to outcome
            </CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">
            {avgDays == null ? "—" : avgDays}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-stone-500">
              Live birth rate (reported)
            </CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">
            {liveBirthRate == null ? "—" : `${liveBirthRate}%`}
          </CardContent>
        </Card>
      </div>

      <div className="rounded-xl border border-stone-200 bg-white">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Clinic</TableHead>
              <TableHead>In progress</TableHead>
              <TableHead>Feedback rate</TableHead>
              <TableHead>Outcomes (90d)</TableHead>
              <TableHead>Compliance</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {clinicStats.map((c) => (
              <TableRow key={c.id}>
                <TableCell className="font-medium">
                  {c.name}{" "}
                  <span className="text-xs text-stone-500">({c.code})</span>
                </TableCell>
                <TableCell>{c.inProgress}</TableCell>
                <TableCell>
                  {c.feedbackRate == null ? "—" : `${c.feedbackRate}%`}
                </TableCell>
                <TableCell>{c.outcomes90}</TableCell>
                <TableCell>{c.compliance}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <div>
        <h2 className="mb-3 text-lg font-semibold">Auto-nudge queue</h2>
        <div className="rounded-xl border border-stone-200 bg-white">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>DRF</TableHead>
                <TableHead>Clinic</TableHead>
                <TableHead>Day</TableHead>
                <TableHead>Scheduled</TableHead>
                <TableHead>Window</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pendingNudges.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-stone-500">
                    No pending nudges this week.
                  </TableCell>
                </TableRow>
              )}
              {pendingNudges.map((n) => {
                const day = n.scheduledAt.toISOString().slice(0, 10);
                return (
                  <TableRow key={n.id}>
                    <TableCell className="font-medium">
                      {n.drf.drfNumber}
                    </TableCell>
                    <TableCell>{n.drf.clinic.name}</TableCell>
                    <TableCell>D+{n.dayOffset}</TableCell>
                    <TableCell className="text-xs">{day}</TableCell>
                    <TableCell className="text-xs">
                      {day <= todayIso ? "Due today / overdue" : "This week"}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}
