"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { encryptJson } from "@/lib/crypto";
import { calculateCrs } from "@/lib/engine/crs/calculate";
import { calcStateSchema, toCrsInput, type CalcState } from "@/lib/engine/crs/calc-state";
import { ruleSetFor } from "@/lib/engine/crs/rules";

/** The server never trusts a total from the browser: it validates and recomputes. */
function score(raw: unknown) {
  const parsed = calcStateSchema.safeParse(raw);
  if (!parsed.success) throw new Error("Those answers aren't valid: " + parsed.error.issues[0].message);
  const { input, error } = toCrsInput(parsed.data);
  if (!input) throw new Error(error ?? "Those answers aren't valid");
  const rules = ruleSetFor(new Date());
  return { state: parsed.data, input, rules, result: calculateCrs(input, rules) };
}

export async function saveScenarioAction(name: string, state: CalcState) {
  const user = await requireUser();
  const { result, rules, state: clean } = score(state);
  const count = await db.scenario.count({ where: { userId: user.id } });
  if (count >= 20) return { error: "You can keep up to 20 scenarios. Delete one first." };
  await db.scenario.create({
    data: { userId: user.id, name: name.trim().slice(0, 80) || "Untitled scenario", ruleSetVersion: rules.version, input: encryptJson(clean), total: result.total },
  });
  revalidatePath("/crs");
  return { error: null };
}

export async function deleteScenarioAction(id: string) {
  const user = await requireUser();
  await db.scenario.deleteMany({ where: { id, userId: user.id } });
  revalidatePath("/crs");
}

export async function saveAssessmentAction(state: CalcState) {
  const user = await requireUser();
  const { result, rules, state: clean, input } = score(state);
  const row = await db.assessment.create({
    data: {
      userId: user.id,
      kind: "crs",
      ruleSetVersion: rules.version,
      inputSnapshot: encryptJson({ state: clean, input }),
      result: JSON.parse(JSON.stringify(result)),
      total: result.total,
    },
  });
  revalidatePath("/history");
  revalidatePath("/dashboard");
  redirect(`/history/${row.id}`);
}
