"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import type { FormState } from "./auth";

const schema = z.object({
  title: z.string().trim().min(2, "Give it a short name").max(120),
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Pick a date"),
});

export async function addDeadlineAction(_: FormState, form: FormData): Promise<FormState> {
  const user = await requireUser();
  const parsed = schema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const count = await db.deadline.count({ where: { userId: user.id, dismissedAt: null } });
  if (count >= 50) return { error: "You have 50 open reminders. Remove some first." };
  await db.deadline.create({ data: { userId: user.id, kind: "custom", title: parsed.data.title, dueDate: new Date(parsed.data.dueDate + "T00:00:00Z"), source: "user" } });
  revalidatePath("/dashboard");
  return { ok: "Reminder added." };
}

export async function dismissDeadlineAction(form: FormData) {
  const user = await requireUser();
  await db.deadline.updateMany({ where: { id: String(form.get("id")), userId: user.id }, data: { dismissedAt: new Date() } });
  revalidatePath("/dashboard");
}
