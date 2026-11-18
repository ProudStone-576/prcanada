import { NextResponse } from "next/server";
import { db } from "@/lib/db";

/** For load balancers and uptime checks. Reveals nothing but up or down. */
export async function GET() {
  try {
    await db.$queryRaw`SELECT 1`;
    return NextResponse.json({ ok: true }, { headers: { "cache-control": "no-store" } });
  } catch {
    return NextResponse.json({ ok: false }, { status: 503, headers: { "cache-control": "no-store" } });
  }
}
