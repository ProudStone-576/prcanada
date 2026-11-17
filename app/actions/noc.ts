"use server";

import { suggestNoc } from "@/lib/noc/server";

export async function suggestNocAction(duties: string, title: string, limit = 5) {
  if (typeof duties !== "string" || typeof title !== "string") return null;
  return suggestNoc(duties, title, Math.min(5, Math.max(1, limit)));
}
