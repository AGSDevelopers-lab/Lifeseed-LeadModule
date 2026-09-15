import Link from "next/link";
import { redirect } from "next/navigation";

import { getSession, permissionGranted, permissionsForRoles } from "@/lib/rbac";
import { NotificationTemplatesClient } from "./templates-client";

export default async function NotificationTemplatesPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!permissionGranted(permissionsForRoles(session.roles), "notification.template.view")) {
    redirect("/admin/leads");
  }
  return (
    <div className="space-y-6">
      <div>
        <Link href="/admin/leads" className="text-sm text-brand-800 hover:underline">
          Back to leads
        </Link>
        <h1 className="text-2xl font-semibold">Notification templates</h1>
        <p className="text-sm text-stone-600">
          Propose → approve SoD. Structural placeholders only. Channel flags remain off.
        </p>
      </div>
      <NotificationTemplatesClient />
    </div>
  );
}
