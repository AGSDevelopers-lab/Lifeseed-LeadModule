import Link from "next/link";
import { redirect } from "next/navigation";
import { LeadStatus } from "@prisma/client";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { prisma } from "@/lib/db";
import {
  getSession,
  permissionGranted,
  permissionsForRoles,
} from "@/lib/rbac";

export default async function AdminLeadsPage({
  searchParams,
}: {
  searchParams: Promise<{
    tier?: string;
    status?: string;
    source?: string;
    personType?: string;
  }>;
}) {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!permissionGranted(permissionsForRoles(session.roles), "lead.list")) {
    redirect("/admin");
  }
  const sp = await searchParams;

  const rows = await prisma.lead.findMany({
    where: {
      ...(sp.tier ? { tier: sp.tier as never } : {}),
      ...(sp.status ? { status: sp.status as never } : {}),
      ...(sp.source ? { source: sp.source as never } : {}),
      ...(sp.personType ? { personType: sp.personType as never } : {}),
    },
    include: {
      assignedTelecaller: { select: { email: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  const [newCount, contacted, counselled, converted] = await Promise.all([
    prisma.lead.count({
      where: { status: { in: [LeadStatus.NEW, LeadStatus.ASSIGNED] } },
    }),
    prisma.lead.count({
      where: {
        status: {
          in: [
            LeadStatus.CONTACTED_QUALIFIED,
            LeadStatus.CONTACTED_CALLBACK_REQUESTED,
          ],
        },
      },
    }),
    prisma.lead.count({
      where: {
        status: {
          in: [
            LeadStatus.COUNSELLING_BOOKED,
            LeadStatus.COUNSELLING_ATTENDED,
          ],
        },
      },
    }),
    prisma.lead.count({ where: { status: LeadStatus.CONVERTED } }),
  ]);

  const canExport = permissionGranted(
    permissionsForRoles(session.roles),
    "lead.export",
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Leads</h1>
          <p className="text-sm text-stone-600">
            Funnel: {newCount} lead → {contacted} contacted → {counselled}{" "}
            counselled → {converted} converted
          </p>
        </div>
        <div className="flex gap-3 text-sm">
          <Link href="/admin/leads/analytics" className="text-emerald-900 hover:underline">
            Analytics
          </Link>
          <Link href="/admin/leads/crm" className="text-emerald-900 hover:underline">
            CRM sync
          </Link>
          <Link href="/admin/leads/do-not-call" className="text-emerald-900 hover:underline">
            Do Not Call
          </Link>
          <Link href="/admin/leads/config" className="text-emerald-900 hover:underline">
            Config
          </Link>
          {canExport && (
            <a
              href="/api/leads/export"
              className="text-emerald-900 hover:underline"
            >
              Export CSV
            </a>
          )}
        </div>
      </div>

      <div className="rounded-xl border border-stone-200 bg-white">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Code</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Source</TableHead>
              <TableHead>Tier</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Telecaller</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={r.id}>
                <TableCell>
                  <Link
                    href={`/admin/leads/${r.id}`}
                    className="font-medium text-emerald-900 hover:underline"
                  >
                    {r.leadCode}
                  </Link>
                </TableCell>
                <TableCell>{r.fullName ?? "—"}</TableCell>
                <TableCell className="text-xs">{r.personType}</TableCell>
                <TableCell className="text-xs">{r.source}</TableCell>
                <TableCell>{r.tier}</TableCell>
                <TableCell className="text-xs">{r.status}</TableCell>
                <TableCell className="text-xs">
                  {r.assignedTelecaller?.email ?? "—"}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
