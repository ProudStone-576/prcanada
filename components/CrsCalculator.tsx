"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { deleteScenarioAction, saveAssessmentAction, saveScenarioAction } from "@/app/actions/crs";
import { calculateCrs } from "@/lib/engine/crs/calculate";
import { toCrsInput, WHAT_IFS, type CalcState, type CalcTest } from "@/lib/engine/crs/calc-state";
import type { CrsRuleSet } from "@/lib/engine/crs/rules";
import { CRS_RULE_SETS } from "@/lib/engine/crs/rules";
import { EDUCATION_LABELS, HIGH_WAGE_LABELS, type CrsResult } from "@/lib/engine/crs/types";
import { ABILITIES, scoreToClb, TESTS, type TestType } from "@/lib/engine/language";
import { Breakdown } from "./Breakdown";
import { Check, Choice, NumberField, SelectField } from "./form/fields";
import { Term } from "./Term";

const EDU = Object.entries(EDUCATION_LABELS) as Array<[CalcState["education"], string]>;
const WAGE = Object.entries(HIGH_WAGE_LABELS) as Array<[CalcState["jobOffer"], string]>;
const ABILITY_LABEL = { listening: "Listening", reading: "Reading", writing: "Writing", speaking: "Speaking" } as const;

export interface SavedScenario {
  id: string;
  name: string;
  state: CalcState;
  ruleSetVersion: string;
}

interface Column {
  key: string;
  name: string;
  result: CrsResult;
  savedId?: string;
}

export function CrsCalculator({ initial, rulesVersion, signedIn, scenarios, fromProfile }: {
  initial: CalcState;
  rulesVersion: string;
  signedIn: boolean;
  scenarios: SavedScenario[];
  fromProfile: boolean;
}) {
  const [s, setS] = useState<CalcState>(initial);
  const [compare, setCompare] = useState<string[]>([]);
  const [name, setName] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const rules = CRS_RULE_SETS.find((r) => r.version === rulesVersion) as CrsRuleSet;
  const set = <K extends keyof CalcState>(k: K, v: CalcState[K]) => setS((p) => ({ ...p, [k]: v }));

  const scored = useMemo(() => {
    const { input, error } = toCrsInput(s);
    return { error, result: input ? calculateCrs(input, rules) : null };
  }, [s, rules]);

  const columns: Column[] = useMemo(() => {
    const cols: Column[] = [];
    for (const key of compare) {
      const w = WHAT_IFS.find((x) => x.key === key);
      if (w) {
        const next = w.apply(s);
        const { input } = next ? toCrsInput(next) : { input: null };
        if (input) cols.push({ key, name: w.label, result: calculateCrs(input, rules) });
        continue;
      }
      const saved = scenarios.find((x) => x.id === key);
      if (saved) {
        const { input } = toCrsInput(saved.state);
        if (input) cols.push({ key, name: saved.name, result: calculateCrs(input, rules), savedId: saved.id });
      }
    }
    return cols;
  }, [compare, s, scenarios, rules]);

  const toggle = (key: string) => setCompare((c) => (c.includes(key) ? c.filter((x) => x !== key) : [...c, key].slice(-3)));

  return (
    <div className="calc">
      <form className="calc-sections" onSubmit={(e) => e.preventDefault()} noValidate>
        {fromProfile && <p className="notice" style={{ marginBottom: "var(--space-xl)" }}>Filled in from your assessment. Changes here don&apos;t change your saved answers.</p>}
        <fieldset>
          <legend>You</legend>
          <div className="grid-2">
            <NumberField label="Age" min={16} max={80} value={s.age} onChange={(v) => set("age", Math.round(v ?? 0))} />
            <SelectField label="Highest education" value={s.education} onChange={(v) => v && set("education", v)} options={EDU} hint={<>Foreign credentials need an <Term k="eca">ECA</Term> to count.</>} />
          </div>
          <div style={{ marginTop: "var(--space-lg)" }}>
            <Choice
              label="Is a spouse or partner coming to Canada with you, who is not a citizen or PR?"
              value={s.spouse ? "yes" : "no"}
              onChange={(v) => set("spouse", v === "yes")}
              options={[["no", "No"], ["yes", "Yes"]]}
            />
          </div>
        </fieldset>

        <fieldset>
          <legend>Language tests</legend>
          <TestInputs label="English" value={s.english} kinds={["ielts_gt", "celpip_g", "pte_core"]} onChange={(t) => set("english", t)} />
          <div style={{ marginTop: "var(--space-lg)" }}>
            <TestInputs label="French" value={s.french} kinds={["tef_canada", "tcf_canada"]} onChange={(t) => set("french", t)} />
          </div>
        </fieldset>

        <fieldset>
          <legend>Work</legend>
          <div className="grid-2">
            <NumberField label="Years of skilled work in Canada" min={0} max={10} value={s.canadianWorkYears} onChange={(v) => set("canadianWorkYears", Math.round(v ?? 0))} hint={<>Paid, <Term k="teer">TEER</Term> 0 to 3, last 10 years, full-time or equal part-time.</>} />
            <NumberField label="Years of skilled work outside Canada" min={0} max={10} value={s.foreignWorkYears} onChange={(v) => set("foreignWorkYears", Math.round(v ?? 0))} hint="In the last 10 years." />
            <SelectField label={<>12 months of Canadian work in a <Term k="high_wage">high-wage occupation</Term></>} value={s.highWageExperience} onChange={(v) => set("highWageExperience", v ?? "none")} options={WAGE} placeholder="No" />
            <SelectField label="Job offer in a high-wage occupation" value={s.jobOffer} onChange={(v) => set("jobOffer", v ?? "none")} options={WAGE} placeholder="No job offer" />
          </div>
          <div style={{ marginTop: "var(--space-md)" }}>
            <Check checked={s.certificateOfQualification} onChange={(v) => set("certificateOfQualification", v)}>I have a certificate of qualification in a trade from a province or territory</Check>
          </div>
        </fieldset>

        <fieldset>
          <legend>Other points</legend>
          <div className="form">
            <SelectField
              label="Post-secondary education completed in Canada"
              value={s.canadianEducation}
              onChange={(v) => set("canadianEducation", v ?? "none")}
              options={[["one_or_two_year", "One- or two-year credential"], ["three_year_or_more", "Three years or more, or a master's, professional or doctoral degree"]]}
              placeholder="None"
              hint="Full-time, in person, in Canada for at least 8 months."
            />
            <Check checked={s.siblingInCanada} onChange={(v) => set("siblingInCanada", v)}>A brother or sister in Canada, 18 or older, who is a citizen or PR</Check>
            <Check checked={s.provincialNomination} onChange={(v) => set("provincialNomination", v)}>I have a <Term k="pnp">provincial nomination</Term></Check>
          </div>
        </fieldset>

        {s.spouse && (
          <fieldset>
            <legend>Your spouse or partner</legend>
            <div className="grid-2">
              <SelectField label="Their highest education" value={s.spouseEducation} onChange={(v) => v && set("spouseEducation", v)} options={EDU} />
              <NumberField label="Their years of Canadian work" min={0} max={10} value={s.spouseCanadianWorkYears} onChange={(v) => set("spouseCanadianWorkYears", Math.round(v ?? 0))} />
            </div>
            <div style={{ marginTop: "var(--space-lg)" }}>
              <TestInputs label="Their language test" value={s.spouseTest} kinds={["ielts_gt", "celpip_g", "pte_core", "tef_canada", "tcf_canada"]} onChange={(t) => set("spouseTest", t)} />
            </div>
          </fieldset>
        )}
      </form>

      <div className="calc__result">
        <section className="stock sheet" aria-labelledby="score-h" aria-live="polite">
          <div className="sheet__head">
            <div>
              <h2 id="score-h" className="sheet__title">Your <Term k="crs">CRS</Term> score</h2>
              <p className="sheet__meta">
                Rules in effect from {rules.effectiveFrom}. <a href={rules.sourceUrl} target="_blank" rel="noopener noreferrer">IRCC criteria</a>
              </p>
            </div>
            <p className="total-fig">{scored.result?.total ?? "Not yet"}</p>
          </div>
          {scored.error && <p className="notice notice--error">{scored.error}</p>}
          {scored.result?.warnings.map((w) => <p key={w} className="notice">{w}</p>)}
          {scored.result && <Breakdown result={scored.result} caption="CRS points breakdown" />}
          <p className="small muted">
            A score is not eligibility. You must also qualify for one of the <Term k="express_entry">Express Entry</Term> programs; we&apos;ll check that in the next release.
          </p>
        </section>

        <section className="stock panel" aria-labelledby="whatif-h">
          <h2 id="whatif-h">What if</h2>
          <p className="small muted" style={{ marginBottom: "var(--space-md)" }}>Pick up to three to compare with your score now.</p>
          <div className="whatifs">
            {WHAT_IFS.filter((w) => w.apply(s) !== null).map((w) => (
              <label className="choice" key={w.key}>
                <input type="checkbox" checked={compare.includes(w.key)} onChange={() => toggle(w.key)} />
                <span>{w.label}</span>
              </label>
            ))}
            {scenarios.map((sc) => (
              <label className="choice" key={sc.id}>
                <input type="checkbox" checked={compare.includes(sc.id)} onChange={() => toggle(sc.id)} />
                <span>Saved: {sc.name}</span>
              </label>
            ))}
          </div>

          {columns.length > 0 && scored.result && (
            <div className="compare" style={{ marginTop: "var(--space-lg)" }}>
              <table className="ledger">
                <caption className="visually-hidden">Scenario comparison</caption>
                <thead>
                  <tr>
                    <th scope="col">Section</th>
                    <th scope="col" className="num">Now</th>
                    {columns.map((c) => <th key={c.key} scope="col" className="num">{c.name}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {scored.result.sections.map((sec) => (
                    <tr key={sec.key}>
                      <th scope="row">{sec.label}</th>
                      <td className="num">{sec.points}</td>
                      {columns.map((c) => <td key={c.key} className="num">{c.result.sections.find((x) => x.key === sec.key)?.points ?? 0}</td>)}
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <th scope="row">Total</th>
                    <td className="num">{scored.result.total}</td>
                    {columns.map((c) => {
                      const d = c.result.total - scored.result!.total;
                      return (
                        <td key={c.key} className="num">
                          {c.result.total}{" "}
                          <span className={d > 0 ? "delta-up" : d < 0 ? "delta-down" : "muted"}>({d > 0 ? "+" : ""}{d})</span>
                        </td>
                      );
                    })}
                  </tr>
                </tfoot>
              </table>
              {columns.filter((c) => c.savedId).map((c) => (
                <button key={c.key} type="button" className="linklike small" style={{ marginTop: "var(--space-sm)", marginRight: "var(--space-md)" }} onClick={() => start(async () => { await deleteScenarioAction(c.savedId!); setCompare((x) => x.filter((k) => k !== c.key)); })}>
                  Delete &quot;{c.name}&quot;
                </button>
              ))}
            </div>
          )}
        </section>

        <section className="stock panel" aria-labelledby="save-h">
          <h2 id="save-h">Keep this</h2>
          {signedIn ? (
            <div className="form">
              <div className="field">
                <label htmlFor="scn">Scenario name</label>
                <input id="scn" className="input" value={name} maxLength={80} onChange={(e) => setName(e.target.value)} placeholder="For example: after CELPIP retake" />
              </div>
              <div className="actions">
                <button type="button" className="btn btn--card" disabled={pending || !scored.result} onClick={() => start(async () => { const r = await saveScenarioAction(name, s); setMsg(r.error ?? "Scenario saved. Tick it above to compare."); if (!r.error) setName(""); })}>
                  Save as scenario
                </button>
                <button type="button" className="btn btn--ink" disabled={pending || !scored.result} aria-busy={pending} onClick={() => start(() => saveAssessmentAction(s))}>
                  Record in my history
                </button>
                <Link href="/history" className="small">View history</Link>
              </div>
              <p className="small muted" aria-live="polite">{msg}</p>
            </div>
          ) : (
            <p className="small">
              Nothing you enter here is stored. <Link href="/signup">Create an account</Link> to save scenarios and keep a dated history of your score.
            </p>
          )}
        </section>
      </div>
    </div>
  );
}

function TestInputs({ label, value, kinds, onChange }: { label: string; value: CalcTest | null; kinds: TestType[]; onChange: (t: CalcTest | null) => void }) {
  const opts = kinds.map((k) => [k, TESTS[k].label] as [TestType, string]);
  if (!value) {
    return <SelectField label={`${label} test`} value={undefined} onChange={(t) => t && onChange({ type: t, listening: 0, reading: 0, writing: 0, speaking: 0 })} options={opts} placeholder="No test" />;
  }
  const spec = TESTS[value.type];
  const name = spec.language === "french" ? "NCLC" : "CLB";
  return (
    <div className="form" style={{ gap: "var(--space-md)" }}>
      <SelectField label={`${label} test`} value={value.type} onChange={(t) => onChange(t ? { ...value, type: t } : null)} options={opts} placeholder="No test" />
      <div className="grid-4">
        {ABILITIES.map((a) => {
          let hint: string;
          try {
            const l = scoreToClb(value.type, a, value[a]);
            hint = l === 0 ? `Below ${name} 4` : `${name} ${l}`;
          } catch {
            hint = `${spec.range[a][0]} to ${spec.range[a][1]}`;
          }
          return <NumberField key={a} label={ABILITY_LABEL[a]} step={spec.step} min={spec.range[a][0]} max={spec.range[a][1]} value={value[a]} onChange={(n) => onChange({ ...value, [a]: n ?? 0 })} hint={hint} />;
        })}
      </div>
      {spec.note && <p className="hint">{spec.note}</p>}
    </div>
  );
}
