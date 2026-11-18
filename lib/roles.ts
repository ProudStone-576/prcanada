import "server-only";
import { notFound } from "next/navigation";
import { requireUser } from "./auth";

/** Reviewers are listed by email in REVIEWER_EMAILS (comma-separated). Nobody is a reviewer by default. */
export function isReviewer(email: string): boolean {
  const list = (process.env.REVIEWER_EMAILS ?? "").split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
  return list.includes(email.toLowerCase());
}

export async function requireReviewer() {
  const user = await requireUser();
  if (!isReviewer(user.email)) notFound();
  return user;
}

/** Scheduled jobs authenticate with `Authorization: Bearer $CRON_SECRET`. */
export function cronAuthorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret || secret.length < 24) return false;
  return request.headers.get("authorization") === `Bearer ${secret}`;
}
