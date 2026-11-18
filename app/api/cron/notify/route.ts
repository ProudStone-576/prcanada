import { NextResponse } from "next/server";
import { cronAuthorized } from "@/lib/roles";
import { runNotifications } from "@/lib/notify/run";

export const maxDuration = 300;

export async function POST(request: Request) {
  if (!cronAuthorized(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json(await runNotifications());
}
