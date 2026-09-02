import { redirect } from "next/navigation";
import { UserRole } from "@prisma/client";

import { BookCounsellingForm } from "@/app/(portals)/telecaller/leads/[id]/book-counselling/book-form";
import { prisma } from "@/lib/db";
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
