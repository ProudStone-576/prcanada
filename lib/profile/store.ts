import "server-only";
import { db } from "../db";
import { decryptJson, encryptJson } from "../crypto";
import { profileSchema, type Profile } from "./schema";

/** Every read and write is keyed by the session user's id; there is no other way in. */
export async function loadProfile(userId: string): Promise<{ profile: Profile; completedSteps: string[]; updatedAt: Date | null }> {
  const row = await db.profile.findUnique({ where: { userId } });
  if (!row) return { profile: {}, completedSteps: [], updatedAt: null };
  const parsed = profileSchema.safeParse(decryptJson<unknown>(row.ciphertext));
  return { profile: parsed.success ? parsed.data : {}, completedSteps: row.completedSteps, updatedAt: row.updatedAt };
}

export async function storeProfile(userId: string, profile: Profile, completedStep?: string) {
  const existing = await db.profile.findUnique({ where: { userId }, select: { completedSteps: true } });
  const steps = new Set(existing?.completedSteps ?? []);
  if (completedStep) steps.add(completedStep);
  const ciphertext = encryptJson(profile);
  await db.profile.upsert({
    where: { userId },
    create: { userId, ciphertext, completedSteps: [...steps] },
    update: { ciphertext, completedSteps: [...steps] },
  });
}
