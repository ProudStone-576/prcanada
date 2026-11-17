import { currentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { decryptJson } from "@/lib/crypto";
import { calcStateSchema, DEFAULT_STATE, type CalcState } from "@/lib/engine/crs/calc-state";
import { ruleSetFor } from "@/lib/engine/crs/rules";
import { loadProfile } from "@/lib/profile/store";
import { calcStateFromProfile } from "@/lib/profile/to-calc";
import { CrsCalculator, type SavedScenario } from "@/components/CrsCalculator";
import { SRC } from "@/lib/sources";

export const metadata = {
  title: "CRS calculator",
  description: "Calculate your Express Entry CRS score with IRCC's November 3, 2026 rules, see how every point was earned, and compare what-if scenarios.",
};

export default async function CrsPage() {
  const user = await currentUser();
  const now = new Date();
  const rules = ruleSetFor(now);
  let initial: CalcState = DEFAULT_STATE;
  let fromProfile = false;
  let scenarios: SavedScenario[] = [];

  if (user) {
    const { profile } = await loadProfile(user.id);
    const prefilled = calcStateFromProfile(profile, now);
    if (prefilled) {
      initial = prefilled;
      fromProfile = true;
    }
    const rows = await db.scenario.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" } });
    scenarios = rows.flatMap((r) => {
      const parsed = calcStateSchema.safeParse(decryptJson(r.input));
      return parsed.success ? [{ id: r.id, name: r.name, state: parsed.data, ruleSetVersion: r.ruleSetVersion }] : [];
    });
  }

  return (
    <div className="container app-main">
      <header className="page-head">
        <h1>CRS calculator</h1>
        <p>
          Worked out line by line from IRCC&apos;s published tables, including the{" "}
          <a href={SRC.crsChanges} target="_blank" rel="noopener noreferrer">November 3, 2026 changes</a>. Your score updates as you type.
        </p>
      </header>
      <CrsCalculator initial={initial} rulesVersion={rules.version} signedIn={Boolean(user)} scenarios={scenarios} fromProfile={fromProfile} />
    </div>
  );
}
