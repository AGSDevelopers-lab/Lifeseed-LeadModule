import { notFound, redirect } from "next/navigation";
import { UserRole } from "@prisma/client";

import { BookCounsellingForm } from "@/app/(portals)/telecaller/leads/[id]/book-counselling/book-form";
import { prisma } from "@/lib/db";
import { resolveLeadActor } from "@/lib/leads/adapters/identity-adapter";
import { prismaLeadAudit } from "@/lib/leads/adapters/prisma-audit";
import { prismaLeadRepository } from "@/lib/leads/adapters/prisma-lead-repository";
import { LeadOwnershipDeniedError } from "@/lib/leads/domain/errors";
import {
  getSession,
  permissionGranted,
  permissionsForRoles,
} from "@/lib/rbac";

type Params = Promise<{ id: string }>;

export default async function BookCounsellingPage({
  params,
}: {
  params: Params;
}) {
  const session = await getSession();
  if (!session) redirect("/login");
  if (
    !permissionGranted(
      permissionsForRoles(session.roles),
      "counselling.book",
    )
  ) {
    redirect("/telecaller/queue");
  }
  const { id } = await params;
  const actor = await resolveLeadActor();
  if (!actor) redirect("/login");
  try {
    const owned = await prismaLeadRepository.byId(id, actor);
    if (!owned) notFound();
    await prismaLeadAudit.recordView({
      actorUserId: actor.userId,
      actorRoles: actor.roles,
      leadId: id,
      siteId: actor.siteId ?? owned.props.ownership.siteId,
    });
  } catch (err) {
    if (err instanceof LeadOwnershipDeniedError) notFound();
    throw err;
  }

  const counsellors = await prisma.user.findMany({
    where: {
      isActive: true,
      roles: { some: { role: UserRole.COUNSELLOR } },
    },
    select: { id: true, email: true },
    take: 50,
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Book counselling</h1>
        <p className="text-sm text-stone-600">Recipient lead · next 14 days</p>
      </div>
      <BookCounsellingForm leadId={id} counsellors={counsellors} />
    </div>
  );
}
