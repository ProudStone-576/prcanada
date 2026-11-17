"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { assessBowp, assessPgwp, assessSpousalOwp, TEMP_VERIFIED, type BowpInput, type PgwpInput, type SpouseInput, type TempResult } from "@/lib/engine/temporary";
import { Choice, NumberField, SelectField, TextField, YES_NO } from "./form/fields";

const VERDICT = { meets: "Met", not_met: "Not met", needs_info: "Need to know" } as const;
const OVERALL = { meets: "You appear to meet every requirement we can check.", not_met: "At least one requirement isn't met.", needs_info: "We need a few more answers." } as const;

function Result({ r }: { r: TempResult }) {
  return (
    <section className="stock sheet" aria-live="polite">
      <div className="sheet__head">
        <div>
          <h2 className="sheet__title">{r.name}</h2>
          <p className="sheet__meta">{OVERALL[r.verdict]} Rules checked {TEMP_VERIFIED}.</p>
        </div>
      </div>
      {r.extra?.lengthNote && (
        <p className="notice"><strong>{r.extra.lengthMonths ? `Possible length: ${r.extra.lengthMonths === 36 ? "3 years" : `${r.extra.lengthMonths} months`}.` : "No PGWP length."}</strong> {r.extra.lengthNote}</p>
      )}
      <table className="ledger">
        <caption className="visually-hidden">{r.name} requirements</caption>
        <thead><tr><th scope="col">Requirement</th><th scope="col">You</th></tr></thead>
        <tbody>
          {r.requirements.map((q) => (
            <tr key={q.key}>
              <td>{q.label}{q.detail && <p className="why">{q.detail}</p>}</td>
              <td className={q.verdict === "meets" ? "delta-up" : q.verdict === "not_met" ? "delta-down" : ""} style={{ whiteSpace: "nowrap" }}>{VERDICT[q.verdict]}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {r.notes.length > 0 && <ul className="small muted" style={{ paddingLeft: "var(--space-lg)", margin: 0 }}>{r.notes.map((n) => <li key={n}>{n}</li>)}</ul>}
      <p className="small"><a href={r.sourceUrl} target="_blank" rel="noopener noreferrer">Official page</a></p>
    </section>
  );
}

export function TemporaryTools({ tool, pgwp, today }: { tool: "pgwp" | "spouse" | "bowp"; pgwp: PgwpInput; today: string }) {
  const on = useMemo(() => new Date(today + "T12:00:00Z"), [today]);
  const [p, setP] = useState<PgwpInput>(pgwp);
  const [s, setS] = useState<SpouseInput>({ principal: "worker" });
  const [b, setB] = useState<BowpInput>({});
  const up = <T,>(set: React.Dispatch<React.SetStateAction<T>>) => <K extends keyof T>(k: K, v: T[K]) => set((x) => ({ ...x, [k]: v }));
  const uP = up(setP), uS = up(setS), uB = up(setB);

  const tabs: Array<[typeof tool, string]> = [["pgwp", "Post-graduation work permit"], ["spouse", "Spouse or partner open work permit"], ["bowp", "Bridging open work permit"]];

  return (
    <>
      <nav className="choices" aria-label="Assessments" style={{ marginBottom: "var(--space-xl)" }}>
        {tabs.map(([k, label]) => (
          <Link key={k} href={`/work-permits?tool=${k}`} className="choice" aria-current={k === tool ? "page" : undefined} scroll={false}><span>{label}</span></Link>
        ))}
      </nav>
      <div className="calc">
        <form className="form" onSubmit={(e) => e.preventDefault()}>
          {tool === "pgwp" && (
            <>
              <SelectField label="Type of program" value={p.credential} onChange={(v) => uP("credential", v)} options={[["bachelors", "Bachelor's degree"], ["masters", "Master's degree"], ["doctoral", "Doctoral degree"], ["other_university", "Other university program (for example a certificate)"], ["college", "College, polytechnic or other non-university program"], ["flight_school", "Flight school"]]} />
              <div className="grid-2">
                <NumberField label="Program length in months" min={0} max={120} value={p.programMonths} onChange={(v) => uP("programMonths", v)} />
                <TextField label="Date your school confirmed you completed it" type="date" value={p.completionConfirmedOn} onChange={(v) => uP("completionConfirmedOn", v)} hint="Usually the date of your final marks or completion letter." />
              </div>
              <Choice label="Is your school a DLI and your program PGWP-eligible?" value={p.dliPgwpEligible} onChange={(v) => uP("dliPgwpEligible", v)} options={YES_NO} hint="Your school's international office can confirm this." />
              <Choice label="Were you full-time in every term except possibly the last?" value={p.fullTimeEachTerm} onChange={(v) => uP("fullTimeEachTerm", v)} options={YES_NO} />
              <Choice label="Did you study at least half the program in class, in Canada?" value={p.atLeastHalfInClassInCanada} onChange={(v) => uP("atLeastHalfInClassInCanada", v)} options={YES_NO} />
              <Choice label="Was your study permit valid at some point in the 180 days after you finished?" value={p.studyPermitValidInWindow} onChange={(v) => uP("studyPermitValidInWindow", v)} options={YES_NO} />
              <Choice label="Have you had a PGWP before?" value={p.hadPgwpBefore} onChange={(v) => uP("hadPgwpBefore", v)} options={[["no", "No"], ["yes", "Yes"]]} />
              {(p.credential === "college" || p.credential === "other_university") && (
                <>
                  <Choice label="Did you apply for your study permit on or after November 1, 2024?" value={p.studyPermitAppliedOnOrAfterNov2024} onChange={(v) => uP("studyPermitAppliedOnOrAfterNov2024", v)} options={YES_NO} />
                  {p.studyPermitAppliedOnOrAfterNov2024 === "yes" && (
                    <Choice label="Is your program's field of study (CIP code) on IRCC's eligible list?" value={p.fieldOfStudyEligible} onChange={(v) => uP("fieldOfStudyEligible", v)} options={YES_NO} hint={<>Check on <a href="https://www.canada.ca/en/immigration-refugees-citizenship/services/study-canada/work/after-graduation/eligibility/field-of-study.html" target="_blank" rel="noopener noreferrer">IRCC&apos;s field of study page</a>. IRCC says the list won&apos;t change in 2026.</>} />
                  )}
                </>
              )}
              <p className="small muted">{p.language ? "Using the language results from your profile." : <>Add your test results in the <Link href="/assessment?step=language">assessment</Link> to check the language requirement.</>}</p>
            </>
          )}

          {tool === "spouse" && (
            <>
              <Choice label="Your spouse or partner in Canada is a" value={s.principal} onChange={(v) => setS({ principal: v })} options={[["worker", "Worker"], ["student", "Student"]]} />
              {s.principal === "student" ? (
                <SelectField label="Their program" value={s.studentProgram} onChange={(v) => uS("studentProgram", v)} options={[["masters_16plus", "Master's of 16 months or longer"], ["doctoral", "Doctoral"], ["professional", "A listed professional degree (medicine, law, engineering and others)"], ["other", "Something else"]]} />
              ) : (
                <>
                  <SelectField label="TEER of their job" value={s.workerTeer} onChange={(v) => uS("workerTeer", v)} options={[["0", "TEER 0"], ["1", "TEER 1"], ["2", "TEER 2"], ["3", "TEER 3"], ["4", "TEER 4"], ["5", "TEER 5"]]} />
                  <NumberField label="Months left on their work permit" min={0} max={120} value={s.monthsLeftOnPermit} onChange={(v) => uS("monthsLeftOnPermit", v)} />
                  {(s.workerTeer === "4" || s.workerTeer === "5") && <Choice label="Are they in a permanent residence pathway stream?" value={s.workerOnPrPathway} onChange={(v) => uS("workerOnPrPathway", v)} options={YES_NO} />}
                </>
              )}
            </>
          )}

          {tool === "bowp" && (
            <>
              <SelectField label="Which permanent residence program did you apply under?" value={b.prProgram} onChange={(v) => uB("prProgram", v)} options={[["express_entry", "Express Entry (CEC, FSW or FST)"], ["pnp", "Provincial Nominee Program"], ["quebec", "Quebec skilled worker"], ["other", "Another program"], ["none", "I haven't applied yet"]]} />
              <Choice label="Are you the principal applicant?" value={b.principalApplicant} onChange={(v) => uB("principalApplicant", v)} options={[["yes", "Yes"], ["no", "No"]]} />
              <Choice label="Do you live in Canada?" value={b.inCanada} onChange={(v) => uB("inCanada", v)} options={[["yes", "Yes"], ["no", "No"]]} />
              <Choice label="Have you received an acknowledgement of receipt for the PR application?" value={b.aorReceived} onChange={(v) => uB("aorReceived", v)} options={[["yes", "Yes"], ["no", "No"]]} />
              <SelectField label="Your status today" value={b.status} onChange={(v) => uB("status", v)} options={[["valid_permit", "Valid work permit"], ["maintained", "Maintained status as a worker"], ["can_restore", "Permit expired, within 90 days and eligible to restore"], ["other", "Something else"]]} />
            </>
          )}
        </form>
        <div>
          {tool === "pgwp" && <Result r={assessPgwp(p, on)} />}
          {tool === "spouse" && <Result r={assessSpousalOwp(s)} />}
          {tool === "bowp" && <Result r={assessBowp(b)} />}
        </div>
      </div>
    </>
  );
}
