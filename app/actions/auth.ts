"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";
import { hashPassword, newToken, sha256, verifyPassword } from "@/lib/crypto";
import { audit, clientInfo, CONSENT_VERSION, createSession, destroySession, loginThrottled, requireUser } from "@/lib/auth";
import { sendMail } from "@/lib/mail";

export interface FormState {
  error?: string;
  ok?: string;
  fields?: Record<string, string>;
}

const email = z.string().trim().toLowerCase().email("Enter a valid email address").max(254);
const password = z
  .string()
  .min(10, "Use at least 10 characters")
  .max(200, "Use at most 200 characters");

const signupSchema = z.object({
  name: z.string().trim().max(80).optional(),
  email,
  password,
  consent: z.literal("on", { message: "You need to agree before we can store your information" }),
});

export async function signupAction(_: FormState, form: FormData): Promise<FormState> {
  const parsed = signupSchema.safeParse(Object.fromEntries(form));
  const fields = { name: String(form.get("name") ?? ""), email: String(form.get("email") ?? "") };
  if (!parsed.success) return { error: parsed.error.issues[0].message, fields };
  const { name, email: addr, password: pw } = parsed.data;

  const existing = await db.user.findUnique({ where: { email: addr } });
  if (existing) return { error: "An account with this email already exists. Sign in, or reset your password.", fields };

  const user = await db.user.create({
    data: { email: addr, name: name || null, passwordHash: await hashPassword(pw), consentAt: new Date(), consentVersion: CONSENT_VERSION },
  });
  await audit("signup", user.id);
  await createSession(user.id);
  redirect("/assessment");
}

export async function loginAction(_: FormState, form: FormData): Promise<FormState> {
  const addr = String(form.get("email") ?? "").trim().toLowerCase();
  const pw = String(form.get("password") ?? "");
  const fields = { email: addr };
  const { ip } = await clientInfo();

  if (await loginThrottled(addr, ip)) {
    return { error: "Too many attempts. Wait 15 minutes, or reset your password.", fields };
  }
  const user = await db.user.findUnique({ where: { email: addr } });
  // Verify against a dummy hash when the user is missing so timing does not reveal accounts.
  const ok = await verifyPassword(pw, user?.passwordHash ?? "scrypt$AAAAAAAAAAAAAAAAAAAAAA==$" + "A".repeat(86) + "==");
  await db.loginAttempt.create({ data: { email: addr, ip, success: Boolean(user && ok) } });
  if (!user || !ok) return { error: "That email and password don't match an account.", fields };

  await audit("login", user.id);
  await createSession(user.id);
  const next = String(form.get("next") ?? "");
  redirect(next.startsWith("/") && !next.startsWith("//") ? next : "/dashboard");
}

export async function logoutAction() {
  await destroySession();
  redirect("/");
}

export async function requestResetAction(_: FormState, form: FormData): Promise<FormState> {
  const parsed = email.safeParse(form.get("email"));
  if (!parsed.success) return { error: "Enter a valid email address" };
  const user = await db.user.findUnique({ where: { email: parsed.data } });
  if (user) {
    const { token, hash } = newToken();
    await db.passwordResetToken.create({ data: { tokenHash: hash, userId: user.id, expiresAt: new Date(Date.now() + 30 * 60_000) } });
    const base = process.env.APP_URL ?? "http://localhost:3000";
    await sendMail({
      to: user.email,
      subject: "Reset your PRPath Canada password",
      text: `Use this link within 30 minutes to choose a new password:\n\n${base}/reset-password?token=${token}\n\nIf you didn't ask for this, you can ignore this email.`,
    });
    await audit("reset_requested", user.id);
  }
  return { ok: "If an account uses that email, we've sent a reset link. It works for 30 minutes." };
}

export async function resetPasswordAction(_: FormState, form: FormData): Promise<FormState> {
  const token = String(form.get("token") ?? "");
  const parsed = password.safeParse(form.get("password"));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  if (form.get("password") !== form.get("confirm")) return { error: "The two passwords don't match." };

  const record = await db.passwordResetToken.findUnique({ where: { tokenHash: sha256(token) } });
  if (!record || record.usedAt || record.expiresAt < new Date()) {
    return { error: "This reset link has expired or was already used. Ask for a new one." };
  }
  await db.$transaction([
    db.user.update({ where: { id: record.userId }, data: { passwordHash: await hashPassword(parsed.data) } }),
    db.passwordResetToken.update({ where: { id: record.id }, data: { usedAt: new Date() } }),
    db.session.deleteMany({ where: { userId: record.userId } }),
  ]);
  await audit("password_reset", record.userId);
  await createSession(record.userId);
  redirect("/dashboard");
}

export async function changePasswordAction(_: FormState, form: FormData): Promise<FormState> {
  const user = await requireUser();
  const full = await db.user.findUniqueOrThrow({ where: { id: user.id } });
  if (!(await verifyPassword(String(form.get("current") ?? ""), full.passwordHash))) {
    return { error: "Your current password is not right." };
  }
  const parsed = password.safeParse(form.get("password"));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  await db.user.update({ where: { id: user.id }, data: { passwordHash: await hashPassword(parsed.data) } });
  await db.session.deleteMany({ where: { userId: user.id } });
  await audit("password_changed", user.id);
  await createSession(user.id);
  return { ok: "Password changed. Other devices have been signed out." };
}

export async function deleteAccountAction(_: FormState, form: FormData): Promise<FormState> {
  const user = await requireUser();
  if (String(form.get("confirm") ?? "").trim().toLowerCase() !== user.email) {
    return { error: "Type your email address exactly to confirm." };
  }
  await audit("account_deleted", null);
  // Cascades remove sessions, profile, assessments, scenarios and deadlines.
  await db.user.delete({ where: { id: user.id } });
  await destroySession();
  redirect("/?deleted=1");
}
