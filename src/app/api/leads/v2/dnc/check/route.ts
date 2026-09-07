import { NextResponse } from "next/server";
import { z } from "zod";

import { requirePermission } from "@/lib/rbac";
import { checkDncBulk } from "@/lib/leads/application/dnc";

const schema = z.object({
  items: z.array(
    z.object({
      channel: z.enum(["PHONE", "EMAIL", "WHATSAPP", "SMS", "ALL"]),
      value: z.string().min(1),
    }),
  ),
});

export async function POST(request: Request) {
  try {
    await requirePermission("dnc.check");
  } catch (err) {
    if (err instanceof Response) return err;
    return NextResponse.json(
      { error: { code: "INTERNAL", message: err instanceof Error ? err.message : "Failed" } },
      { status: 500 },
    );
  }
  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json(
      { error: { code: "VALIDATION_ERROR", message: "Invalid JSON" } },
      { status: 400 },
    );
  }
  const parsed = schema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: { code: "VALIDATION_ERROR", message: "Invalid body" } },
      { status: 400 },
    );
  }
  const results = await checkDncBulk(parsed.data.items);
  return NextResponse.json({ results });
}
