/**
 * Which reminders a person should have today. Pure and idempotent: each
 * reminder has a stable key built from the deadline, its date and the
 * threshold, so running the job twice never repeats one.
 */
import { daysUntil, deriveDeadlines } from "../profile/derive";
import type { Profile } from "../profile/schema";
import { expiryOf, type StoredDoc } from "../documents/checks";
import { DOC_TYPES } from "../documents/types";

export const THRESHOLDS = [90, 30, 7, 1] as const;

export interface PendingNotice {
  key: string;
  kind: "deadline" | "document";
  title: string;
  body: string;
  href: string;
  dueDate: string;
}

/** The tightest threshold a deadline has crossed, or null if it's further away than 90 days or already past. */
export function thresholdFor(days: number): number | null {
  if (days < 0) return null;
  let hit: number | null = null;
  for (const t of THRESHOLDS) if (days <= t) hit = t;
  return hit;
}

function when(days: number) {
  return days === 0 ? "today" : days === 1 ? "tomorrow" : `in ${days} days`;
}

export function buildNotices(p: Profile, userDeadlines: Array<{ id: string; title: string; dueDate: string }>, docs: StoredDoc[], on: Date): PendingNotice[] {
  const out: PendingNotice[] = [];
  const push = (base: string, kind: PendingNotice["kind"], title: string, body: string, href: string, due: string) => {
    const n = daysUntil(due, on);
    const t = thresholdFor(n);
    if (t === null) return;
    out.push({ key: `${base}:${due}:${t}`, kind, title: `${title} ${when(n)}`, body, href, dueDate: due });
  };
  for (const d of deriveDeadlines(p, on)) push(`deadline:${d.kind}`, "deadline", d.title, d.detail, "/dashboard", d.dueDate);
  for (const d of userDeadlines) push(`custom:${d.id}`, "deadline", d.title, "A reminder you set.", "/dashboard", d.dueDate);
  for (const d of docs) {
    const exp = expiryOf(d);
    if (exp) push(`doc:${d.id}`, "document", `${DOC_TYPES[d.docType].label} expires`, `Your ${DOC_TYPES[d.docType].label.toLowerCase()} (${d.meta.filename}) expires on ${exp}.`, "/documents", exp);
  }
  return out;
}
