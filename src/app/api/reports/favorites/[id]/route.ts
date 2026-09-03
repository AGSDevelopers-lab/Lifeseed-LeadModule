import { NextResponse } from "next/server";

import { audit } from "@/lib/audit";
import { prisma } from "@/lib/db";
import {
  ForbiddenError,
  UnauthorizedError,
  requirePermission,
} from "@/lib/rbac";

type Ctx = { params: Promise<{ id: string }> };

export async function DELETE(_req: Request, ctx: Ctx) {
  try {
    const session = await requirePermission("report.favorite");
    const { id } = await ctx.params;
    const existing = await prisma.reportFavorite.findUnique({ where: { id } });
    if (!existing || existing.userId !== session.userId) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    await prisma.reportFavorite.delete({ where: { id } });
    await audit.log({
      actorUserId: session.userId,
      action: "report.favorite.delete",
      entityType: "ReportFavorite",
      entityId: id,
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof NextResponse) return e;
    if (e instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (e instanceof ForbiddenError) {
      return NextResponse.json({ error: e.message }, { status: 403 });
    }
    throw e;
  }
}
