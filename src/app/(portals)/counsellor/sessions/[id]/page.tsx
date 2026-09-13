import { notFound, redirect } from "next/navigation";

import { SessionActions } from "@/app/(portals)/counsellor/sessions/[id]/session-actions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/primitives";
import { prisma } from "@/lib/db";
import {
  getSession,
  permissionGranted,
  permissionsForRoles,
} from "@/lib/rbac";

type Params = Promise<{ id: string }>;

export default async function CounsellorSessionDetailPage({
  params,
}: {
  params: Params;
}) {
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

  const { id } = await params;
  const booking = await prisma.counsellingBooking.findUnique({
    where: { id },
    include: {
      lead: {
        select: {
          id: true,
          leadCode: true,
          fullName: true,
          city: true,
          preferredLanguage: true,
          personType: true,
          tier: true,
        },
      },
    },
  });
  if (!booking) notFound();
  if (
    booking.counsellorUserId !== session.userId &&
    !permissionGranted(permissionsForRoles(session.roles), "lead.list")
  ) {
    redirect("/counsellor/dashboard");
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Session · {booking.lead.leadCode}</h1>
        <p className="text-sm text-stone-600">
          {booking.mode} · {booking.bookingStatus} / {booking.status} ·{" "}
          {booking.scheduledAt.toISOString().replace("T", " ").slice(0, 16)} UTC
        </p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Lead (essentials)</CardTitle>
        </CardHeader>
        <CardContent className="text-sm">
          <p>{booking.lead.fullName}</p>
          <p className="text-stone-500">
            {booking.lead.city ?? "—"} · {booking.lead.preferredLanguage ?? "—"}{" "}
            · {booking.lead.tier}
          </p>
        </CardContent>
      </Card>
      <SessionActions
        bookingId={booking.id}
        status={
          booking.bookingStatus === "SCHEDULED" ? "SCHEDULED" : booking.status
        }
      />
    </div>
  );
}
