import Link from "next/link";
import { redirect } from "next/navigation";

import { getSession, permissionGranted, permissionsForRoles } from "@/lib/rbac";
import { DeliveryLogClient } from "./delivery-log-client";

export default async function DeliveryLogPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!permissionGranted(permissionsForRoles(session.roles), "notification.log.view")) {
    redirect("/admin/leads");
  }
  return (
    <div className="space-y-6">
      <div>
        <Link href="/admin/leads" className="text-sm text-emerald-900 hover:underline">
          Back to leads
        </Link>
        <h1 className="text-2xl font-semibold">Notification delivery log</h1>
      </div>
      <DeliveryLogClient />
    </div>
  );
}
