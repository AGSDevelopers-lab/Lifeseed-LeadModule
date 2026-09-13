import { NextResponse } from "next/server";

import { createPrismaAssignmentDirectory } from "@/lib/leads/adapters/prisma-assignment-directory";
import { requirePermission } from "@/lib/rbac";

function errorFromUnknown(err: unknown): Response {
  if (err instanceof Response) return err;
  return NextResponse.json(
    { error: { code: "INTERNAL", message: err instanceof Error ? err.message : "Failed" } },
    { status: 500 },
  );
}

export async function GET() {
  try {
    await requirePermission("lead.list");
  } catch (err) {
    return errorFromUnknown(err);
  }
  const directory = await createPrismaAssignmentDirectory();
  const items = await directory.listAvailableTelecallers();
  return NextResponse.json({
    items,
    deferred: {
      languages: "IAM_MODULE_12",
      skills: "IAM_MODULE_12",
      shifts: "IAM_MODULE_12",
    },
  });
}
