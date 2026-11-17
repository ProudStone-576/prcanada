import { NextResponse } from "next/server";
import { audit, currentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { decryptJson } from "@/lib/crypto";
import { loadProfile } from "@/lib/profile/store";

/** PIPEDA access request: everything we hold about the signed-in user, decrypted, as JSON. */
export async function GET() {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Sign in first" }, { status: 401 });
  const [full, profile, assessments, scenarios, deadlines, logs] = await Promise.all([
    db.user.findUniqueOrThrow({ where: { id: user.id }, select: { email: true, name: true, createdAt: true, consentAt: true, consentVersion: true } }),
    loadProfile(user.id),
    db.assessment.findMany({ where: { userId: user.id } }),
    db.scenario.findMany({ where: { userId: user.id } }),
    db.deadline.findMany({ where: { userId: user.id } }),
    db.auditLog.findMany({ where: { userId: user.id }, select: { action: true, createdAt: true, ip: true } }),
  ]);
  await audit("data_export", user.id);
  const body = {
    exportedAt: new Date().toISOString(),
    account: full,
    profile: profile.profile,
    assessments: assessments.map((a) => ({ id: a.id, createdAt: a.createdAt, ruleSetVersion: a.ruleSetVersion, total: a.total, input: decryptJson(a.inputSnapshot), result: a.result })),
    scenarios: scenarios.map((s) => ({ id: s.id, name: s.name, createdAt: s.createdAt, ruleSetVersion: s.ruleSetVersion, total: s.total, input: decryptJson(s.input) })),
    deadlines,
    activity: logs,
  };
  return new NextResponse(JSON.stringify(body, null, 2), {
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="prpath-export-${new Date().toISOString().slice(0, 10)}.json"`,
      "Cache-Control": "no-store",
    },
  });
}
