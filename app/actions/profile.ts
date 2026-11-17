"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { profileSchema, STEPS, type Profile, type StepKey } from "@/lib/profile/schema";
import { storeProfile } from "@/lib/profile/store";

export interface SaveResult {
  ok: boolean;
  errors?: Record<string, string>;
}

export async function saveProfileAction(profile: Profile, step: StepKey): Promise<SaveResult> {
  const user = await requireUser();
  if (!STEPS.some((s) => s.key === step)) return { ok: false, errors: { _: "Unknown step" } };
  const parsed = profileSchema.safeParse(profile);
  if (!parsed.success) {
    const errors: Record<string, string> = {};
    for (const issue of parsed.error.issues) errors[issue.path.join(".")] ??= issue.message;
    return { ok: false, errors };
  }
  await storeProfile(user.id, parsed.data, step);
  revalidatePath("/dashboard");
  return { ok: true };
}
