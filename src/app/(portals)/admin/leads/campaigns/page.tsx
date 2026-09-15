import Link from "next/link";
import { redirect } from "next/navigation";

import { CampaignsManagerClient } from "./campaigns-client";
import { getSession, permissionGranted, permissionsForRoles } from "@/lib/rbac";

export default async function AdminLeadCampaignsPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!permissionGranted(permissionsForRoles(session.roles), "campaign.view")) {
    redirect("/admin/leads");
  }
  return (
    <div className="space-y-6">
      <div>
        <Link href="/admin/leads" className="text-sm text-brand-800 hover:underline">
          Back to leads
        </Link>
        <h1 className="text-2xl font-semibold">Campaign Manager</h1>
        <p className="text-sm text-stone-600">
          Draft → Active → Paused → Active → Ended. Attribution capture is gated by{" "}
          <code>LEAD_ATTRIBUTION_ENABLED</code>.
        </p>
      </div>
      <CampaignsManagerClient />
    </div>
  );
}
