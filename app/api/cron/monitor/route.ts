import { NextResponse } from "next/server";
import { z } from "zod";
import { cronAuthorized } from "@/lib/roles";
import { runMonitor } from "@/lib/monitor/run";

export const maxDuration = 300;

const body = z.object({ only: z.array(z.string().url()).max(100).optional() }).optional();

/** Checks every watched page, or only the watched URLs listed in `{ "only": [...] }`. */
export async function POST(request: Request) {
  if (!cronAuthorized(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const parsed = body.safeParse(await request.json().catch(() => undefined));
  if (!parsed.success) return NextResponse.json({ error: "Body must be empty or { only: [urls] }" }, { status: 400 });
  return NextResponse.json(await runMonitor({ only: parsed.data?.only }));
}

/** Vercel Cron calls with GET (no body) and the same bearer secret: checks every watched page. */
export async function GET(request: Request) {
  if (!cronAuthorized(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json(await runMonitor());
}
