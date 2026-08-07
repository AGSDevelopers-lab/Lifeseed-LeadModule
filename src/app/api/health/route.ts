import { NextResponse } from "next/server";

import { prisma } from "@/lib/db";

export async function GET() {
  let db = false;
  try {
    await prisma.$queryRaw`SELECT 1`;
    db = true;
  } catch {
    db = false;
  }

  return NextResponse.json({
    status: "ok",
    db,
    timestamp: new Date().toISOString(),
  });
}
