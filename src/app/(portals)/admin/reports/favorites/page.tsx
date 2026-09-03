import Link from "next/link";
import { redirect } from "next/navigation";

import { FavoritesList } from "@/components/reports/favorites-list";
import { prisma } from "@/lib/db";
import {
  getSession,
  permissionGranted,
  permissionsForRoles,
} from "@/lib/rbac";
import { REPORT_CATALOG } from "@/lib/reports/catalog";

export default async function FavoritesPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!permissionGranted(permissionsForRoles(session.roles), "report.favorite")) {
    redirect("/admin/reports");
  }

  const favorites = await prisma.reportFavorite.findMany({
    where: { userId: session.userId },
    orderBy: { createdAt: "desc" },
  });

  const items = favorites.map((f) => ({
    id: f.id,
    displayName: f.displayName,
    reportId: f.reportId,
    href: `/admin/reports/${
      REPORT_CATALOG.find((c) => c.id === f.reportId)?.category.toLowerCase() ??
      "clinical"
    }/${f.reportId}`,
  }));

  return (
    <div className="space-y-6 p-6">
      <Link href="/admin/reports" className="text-sm text-emerald-800 hover:underline">
        ← Reports home
      </Link>
      <h1 className="text-2xl font-semibold">My Favorites</h1>
      <FavoritesList items={items} />
    </div>
  );
}
