import { UserRole } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";

import { audit } from "@/lib/audit";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/rbac";

const bodySchema = z.object({
  userId: z.string().min(1),
  role: z.nativeEnum(UserRole),
  scopeType: z.enum(["global", "site", "clinic"]),
  scopeId: z.string().nullable().optional(),
});

export async function POST(request: Request) {
  try {
    const session = await requirePermission("user.role.assign");
    const json: unknown = await request.json();
    const parsed = bodySchema.safeParse(json);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid body", details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const { userId, role, scopeType } = parsed.data;
    const scopeId =
      scopeType === "global" ? null : (parsed.data.scopeId ?? null);

    if (scopeType !== "global" && !scopeId) {
      return NextResponse.json(
        { error: "scopeId required for site/clinic scope" },
        { status: 400 },
      );
    }

    const target = await prisma.user.findUnique({ where: { id: userId } });
    if (!target) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const existing = await prisma.userRoleAssignment.findFirst({
      where: { userId, role, scopeType, scopeId },
    });
    if (existing) {
      return NextResponse.json(
        { error: "Role already assigned for this scope" },
        { status: 409 },
      );
    }

    const created = await prisma.userRoleAssignment.create({
      data: {
        userId,
        role,
        scopeType,
        scopeId,
        grantedBy: session.userId,
      },
    });

    await audit.log({
      actorUserId: session.userId,
      action: "role.assigned",
      entityType: "UserRoleAssignment",
      entityId: created.id,
      afterJson: {
        targetUserId: userId,
        role,
        scopeType,
        scopeId,
      },
    });

    return NextResponse.json(created, { status: 201 });
  } catch (err) {
    if (err instanceof NextResponse) return err;
    console.error("[user-roles] POST failed", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
