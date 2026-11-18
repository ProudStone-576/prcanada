import "server-only";
import { db } from "./db";

/**
 * Counts an action and says whether it's allowed: at most `limit` in the last
 * `windowMs`. Stored in the database so it holds across server instances.
 */
export async function allow(key: string, limit: number, windowMs: number): Promise<boolean> {
  const since = new Date(Date.now() - windowMs);
  const used = await db.rateEvent.count({ where: { key, createdAt: { gte: since } } });
  if (used >= limit) return false;
  await db.rateEvent.create({ data: { key } });
  return true;
}

export async function pruneRateEvents(olderThanMs = 2 * 86400_000) {
  return db.rateEvent.deleteMany({ where: { createdAt: { lt: new Date(Date.now() - olderThanMs) } } });
}

export const HOUR = 3600_000;
export const MINUTE = 60_000;
