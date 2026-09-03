import { NextResponse } from "next/server";
import { z } from "zod";

import { audit } from "@/lib/audit";
import { prisma } from "@/lib/db";
import {
  ForbiddenError,
  UnauthorizedError,
  requirePermission,
} from "@/lib/rbac";

const createSchema = z.object({
  reportId: z.string().min(1),
  displayName: z.string().min(1),
  savedFilters: z.record(z.string(), z.unknown()).nullable().optional(),
});

export async function GET(req: Request) {
  try {
    const session = await requirePermission("report.favorite");
    const reportId = new URL(req.url).searchParams.get("reportId");
    const favorites = await prisma.reportFavorite.findMany({
      where: {
        userId: session.userId,
        ...(reportId ? { reportId } : {}),
      },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json({ favorites });
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

export async function POST(req: Request) {
  try {
    const session = await requirePermission("report.favorite");
    const json: unknown = await req.json();
    const body = createSchema.parse(json);

    const favorite = await prisma.reportFavorite.upsert({
      where: {
        userId_reportId_displayName: {
          userId: session.userId,
          reportId: body.reportId,
          displayName: body.displayName,
        },
      },
      create: {
        userId: session.userId,
        reportId: body.reportId,
        displayName: body.displayName,
        savedFilters: body.savedFilters ?? undefined,
      },
      update: {
        savedFilters: body.savedFilters ?? undefined,
      },
    });

    await audit.log({
      actorUserId: session.userId,
      action: "report.favorite.save",
      entityType: "ReportFavorite",
      entityId: favorite.id,
      afterJson: { reportId: body.reportId },
    });

    return NextResponse.json({ favorite }, { status: 201 });
  } catch (e) {
    if (e instanceof NextResponse) return e;
    if (e instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (e instanceof ForbiddenError) {
      return NextResponse.json({ error: e.message }, { status: 403 });
    }
    if (e instanceof z.ZodError) {
      return NextResponse.json({ error: e.flatten() }, { status: 400 });
    }
    console.error(e);
    return NextResponse.json({ error: "Save failed" }, { status: 500 });
  }
}
