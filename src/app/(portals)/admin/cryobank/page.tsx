import Link from "next/link";
import { redirect } from "next/navigation";
import { SampleCategory, SampleGrade } from "@prisma/client";

import { BulkMovePanel } from "./bulk-move-panel";
import { Button } from "@/components/ui/primitives";
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

type SearchParams = Promise<Record<string, string | string[] | undefined>>;
function one(v: string | string[] | undefined) {
  return Array.isArray(v) ? v[0] : v;
}

export default async function CryobankPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!permissionGranted(permissionsForRoles(session.roles), "sample.list")) {
    redirect("/admin");
  }

  const sp = await searchParams;
  const category = one(sp.category) as SampleCategory | undefined;
  const grade = one(sp.grade) as SampleGrade | undefined;
  const tankId = one(sp.tank);

  const vials = await prisma.vial.findMany({
    where: {
      isDiscarded: false,
      ...(category ? { category } : {}),
      ...(grade ? { grade } : {}),
      ...(tankId ? { tankId } : {}),
    },
    include: {
      tank: true,
      sample: { include: { donor: true, site: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 300,
  });

  const tanks = await prisma.cryoTank.findMany({ orderBy: { tankCode: "asc" } });
  const witnesses = await prisma.user.findMany({
    where: {
      isActive: true,
      id: { not: session.userId },
      roles: {
        some: {
          role: {
            in: [
              "BANK_WITNESS",
              "BANK_CRYOBANK_TECH",
              "BANK_LAB_HEAD",
              "BANK_SR_ANDROLOGIST",
              "BANK_SUPER_ADMIN",
            ],
          },
        },
      },
    },
    select: { id: true, email: true },
    take: 50,
  });

  // Aggregate by sample for inventory table
  const bySample = new Map<
    string,
    {
      sampleId: string;
      sampleCode: string;
      donorCode: string;
      donorId: string;
      type: string;
      tankCode: string;
      tankName: string;
      canister: string;
      rack: string;
      vials: number;
      grade: string | null;
      category: string | null;
    }
  >();

  for (const v of vials) {
    const key = v.sampleId;
    const existing = bySample.get(key);
    if (existing) {
      existing.vials += 1;
    } else {
      bySample.set(key, {
        sampleId: v.sampleId,
        sampleCode: v.sample.sampleCode,
        donorCode: v.sample.donor.donorCode,
        donorId: v.sample.donorId,
        type: v.sample.sampleType,
        tankCode: v.tank.tankCode,
        tankName: v.tank.name,
        canister: v.canisterCode,
        rack: v.rackCode,
        vials: 1,
        grade: v.grade ?? v.sample.grade,
        category: v.category ?? v.sample.category,
      });
    }
  }

  const rows = [...bySample.values()];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-stone-900">
          Cryostorage inventory
        </h1>
        <p className="text-sm text-stone-600">
          Physical location of vials by tank, canister, and rack — with grade and
          category.
        </p>
      </div>

      <form
        method="get"
        action="/admin/cryobank"
        className="flex flex-wrap gap-3 rounded-xl border border-stone-200 bg-white p-4"
      >
        <label className="flex flex-col gap-1 text-xs font-medium text-stone-600">
          Category
          <select
            name="category"
            defaultValue={category ?? ""}
            className="h-10 rounded-md border border-stone-300 px-2 text-sm"
          >
            <option value="">All</option>
            {Object.values(SampleCategory).map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium text-stone-600">
          Grade
          <select
            name="grade"
            defaultValue={grade ?? ""}
            className="h-10 rounded-md border border-stone-300 px-2 text-sm"
          >
            <option value="">All</option>
            {Object.values(SampleGrade).map((g) => (
              <option key={g} value={g}>
                {g}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium text-stone-600">
          Tank
          <select
            name="tank"
            defaultValue={tankId ?? ""}
            className="h-10 rounded-md border border-stone-300 px-2 text-sm"
          >
            <option value="">All</option>
            {tanks.map((t) => (
              <option key={t.id} value={t.id}>
                {t.tankCode}
              </option>
            ))}
          </select>
        </label>
        <div className="flex items-end gap-2">
          <Button type="submit">Apply</Button>
          <Link href="/admin/cryobank">
            <Button type="button" variant="outline">
              Clear
            </Button>
          </Link>
        </div>
      </form>

      <div className="rounded-xl border border-stone-200 bg-white">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Sample</TableHead>
              <TableHead>Donor</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Tank ID</TableHead>
              <TableHead>Tank name</TableHead>
              <TableHead>Canister</TableHead>
              <TableHead>Rack</TableHead>
              <TableHead>Vials</TableHead>
              <TableHead>Grade</TableHead>
              <TableHead>Category</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={10} className="text-center text-stone-500">
                  No vials in inventory.
                </TableCell>
              </TableRow>
            )}
            {rows.map((r) => (
              <TableRow key={r.sampleId}>
                <TableCell>
                  <Link
                    href={`/admin/samples/${r.sampleId}`}
                    className="font-medium text-emerald-900 hover:underline"
                  >
                    {r.sampleCode}
                  </Link>
                </TableCell>
                <TableCell>
                  <Link href={`/admin/donors/${r.donorId}`}>{r.donorCode}</Link>
                </TableCell>
                <TableCell>{r.type}</TableCell>
                <TableCell>{r.tankCode}</TableCell>
                <TableCell>{r.tankName}</TableCell>
                <TableCell>{r.canister}</TableCell>
                <TableCell>{r.rack}</TableCell>
                <TableCell>{r.vials}</TableCell>
                <TableCell>{r.grade ?? "—"}</TableCell>
                <TableCell>{r.category ?? "—"}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <BulkMovePanel tanks={tanks} witnesses={witnesses} />
    </div>
  );
}
