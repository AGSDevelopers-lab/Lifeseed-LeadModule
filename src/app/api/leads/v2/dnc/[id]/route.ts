import { NextResponse } from "next/server";
import { z } from "zod";

import { requirePermission } from "@/lib/rbac";
import { audit } from "@/lib/audit";
import { removeDnc } from "@/lib/leads/application/dnc";

const bodySchema = z.object({
  authorityNote: z.string().min(1),
});

export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  let session;
  try {
    session = await requirePermission("dnc.remove");
  } catch (err) {
    if (err instanceof Response) return err;
    return NextResponse.json(
      { error: { code: "INTERNAL", message: err instanceof Error ? err.message : "Failed" } },
      { status: 500 },
    );
  }
  const { id } = await context.params;
  let json: unknown = {};
  try {
    json = await request.json();
  } catch {
    json = {};
  }
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: { code: "VALIDATION_ERROR", message: "Authority note is required" } },
      { status: 400 },
    );
  }
  try {
    const row = await removeDnc(id, {
      authorityUserId: session.userId,
      authorityNote: parsed.data.authorityNote,
    });
    await audit.log({
      actorUserId: session.userId,
      action: "dnc.remove",
      entityType: "LeadDoNotCall",
      entityId: row.id,
      afterJson: { removalNote: parsed.data.authorityNote },
    });
    return NextResponse.json({ ok: true, id: row.id });
  } catch (err) {
    return NextResponse.json(
      { error: { code: "INTERNAL", message: err instanceof Error ? err.message : "Failed" } },
      { status: 500 },
    );
  }
}
