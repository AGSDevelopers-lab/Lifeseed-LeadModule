import Link from "next/link";
import { redirect } from "next/navigation";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/primitives";
import {
  getSession,
  portalHome,
  portalsForRoles,
  type PortalKind,
} from "@/lib/rbac";

const PORTAL_COPY: Record<
  PortalKind,
  { title: string; description: string }
> = {
  admin: {
    title: "Bank Admin",
    description: "SetuAI operations · labs · dispatch · compliance",
  },
  clinic: {
    title: "Clinic Portal",
    description: "DRFs · recipients · cycle events · dispatch receipt",
  },
  donor: {
    title: "Donor Portal",
    description: "Profile · consent · appointments · honorarium",
  },
  recipient: {
    title: "Recipient Portal",
    description: "Packages · matching · cycle status · payments",
  },
  telecaller: {
    title: "Telecaller Portal",
    description: "Lead queue · dispositions · counselling booking",
  },
  counsellor: {
    title: "Counsellor Portal",
    description: "Sessions · attendance · registration recommend",
  },
};

export default async function PortalPickerPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const portals = portalsForRoles(session.roles);

  if (portals.length === 0) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-stone-50 px-4">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle>No portal access</CardTitle>
            <CardDescription>
              Your account ({session.email}) has no role assignments. Contact a
              Bank Super Admin.
            </CardDescription>
          </CardHeader>
        </Card>
      </main>
    );
  }

  if (portals.length === 1) {
    redirect(portalHome(portals[0]));
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-stone-100 via-emerald-50 to-stone-200 px-4 py-16">
      <div className="mx-auto max-w-3xl">
        <h1 className="mb-2 text-3xl font-semibold text-stone-900">
          Choose a portal
        </h1>
        <p className="mb-8 text-stone-600">
          Signed in as {session.email}. You have access to multiple portals.
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          {portals.map((portal) => (
            <Link key={portal} href={portalHome(portal)}>
              <Card className="h-full transition hover:border-emerald-700 hover:shadow-md">
                <CardHeader>
                  <CardTitle className="text-xl">
                    {PORTAL_COPY[portal].title}
                  </CardTitle>
                  <CardDescription>
                    {PORTAL_COPY[portal].description}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <span className="text-sm font-medium text-emerald-800">
                    Enter →
                  </span>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </div>
    </main>
  );
}
