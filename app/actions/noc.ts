"use server";

import { suggestNoc } from "@/lib/noc/server";
import { clientInfo } from "@/lib/auth";
import { allow, MINUTE } from "@/lib/ratelimit";

export async function suggestNocAction(duties: string, title: string, limit = 5) {
  if (typeof duties !== "string" || typeof title !== "string") return null;
  const { ip } = await clientInfo();
  if (!(await allow(`noc:ip:${ip}`, 60, 10 * MINUTE))) return { ok: false, reason: "Too many searches in a short time. Try again in a few minutes.", confidence: null, candidates: [], titleNote: null, dataVersion: "" };
  return suggestNoc(duties, title, Math.min(5, Math.max(1, limit)));
}
