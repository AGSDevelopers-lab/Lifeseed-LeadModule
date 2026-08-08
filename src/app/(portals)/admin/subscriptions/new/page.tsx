import { redirect } from "next/navigation";

import { SubscriptionCreateForm } from "./subscription-create-form";
import { prisma } from "@/lib/db";
import {
  getSession,
  permissionGranted,
  permissionsForRoles,
} from "@/lib/rbac";

export default async function NewSubscriptionPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (
    !permissionGranted(
      permissionsForRoles(session.roles),
      "subscription.create",
    )
  ) {
    redirect("/admin/subscriptions");
  }

  const [clinics, recipients, sites] = await Promise.all([
    prisma.clinic.findMany({ orderBy: { clinicCode: "asc" } }),
    prisma.recipient.findMany({ orderBy: { recipientCode: "asc" }, take: 200 }),
    prisma.site.findMany({ where: { isActive: true }, orderBy: { code: "asc" } }),
  ]);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold text-stone-900">
        New subscription
      </h1>
      <SubscriptionCreateForm
        clinics={clinics.map((c) => ({
          id: c.id,
          clinicCode: c.clinicCode,
          name: c.name,
          siteId: c.siteId,
        }))}
        recipients={recipients.map((r) => ({
          id: r.id,
          recipientCode: r.recipientCode,
          fullName: r.fullName,
          clinicId: r.clinicId,
        }))}
        sites={sites.map((s) => ({ id: s.id, code: s.code }))}
      />
    </div>
  );
}
