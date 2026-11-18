"use server";

import { revalidatePath } from "next/cache";
import { audit, requireUser } from "@/lib/auth";
import { db } from "@/lib/db";

export async function markAllReadAction() {
  const user = await requireUser();
  await db.notification.updateMany({ where: { userId: user.id, readAt: null }, data: { readAt: new Date() } });
  revalidatePath("/", "layout");
}

export async function setEmailRemindersAction(on: boolean) {
  const user = await requireUser();
  await db.user.update({ where: { id: user.id }, data: { emailReminders: on } });
  await audit(on ? "email_reminders_on" : "email_reminders_off", user.id);
  revalidatePath("/account");
  revalidatePath("/notifications");
}
