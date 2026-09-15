import Link from "next/link";
import { redirect } from "next/navigation";

import { getSession, permissionGranted, permissionsForRoles } from "@/lib/rbac";
import { AssignmentCentreClient } from "./assignment-centre-client";

export default async function AssignmentCentrePage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!permissionGranted(permissionsForRoles(session.roles), "lead.list")) {
    redirect("/admin/leads");
  }
  return (
    <div className="space-y-6">
      <div>
        <Link href="/admin/leads" className="text-sm text-brand-800 hover:underline">
          Back to leads
        </Link>
        <h1 className="text-2xl font-semibold">Assignment Centre</h1>
        <p className="text-sm text-stone-600">
          Site, capacity, and active eligibility only. This view does not perform
          shift, skill, or language matching.
        </p>
      </div>
      <AssignmentCentreClient />
    </div>
  );
}
