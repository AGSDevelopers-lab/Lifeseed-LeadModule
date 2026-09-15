import Link from "next/link";
import { redirect } from "next/navigation";

import { getSession, permissionGranted, permissionsForRoles } from "@/lib/rbac";
import { DuplicateReviewClient } from "./duplicate-review-client";

export default async function DuplicateReviewPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!permissionGranted(permissionsForRoles(session.roles), "duplicate.review")) {
    redirect("/admin/leads");
  }
  return (
    <div className="space-y-6">
      <div>
        <Link href="/admin/leads" className="text-sm text-brand-800 hover:underline">
          Back to leads
        </Link>
        <h1 className="text-2xl font-semibold">Duplicate Review</h1>
        <p className="text-sm text-stone-600">
          Side-by-side compare of DuplicateCase pairs. Merge is a human decision only
          (no auto-merge). POSSIBLE is reserved and is not populated.
        </p>
      </div>
      <DuplicateReviewClient />
    </div>
  );
}
