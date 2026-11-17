"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { saveProfileAction } from "@/app/actions/profile";
import { calculateCrs } from "@/lib/engine/crs/calculate";
import { ruleSetFor } from "@/lib/engine/crs/rules";
import { EDUCATION_LABELS, HIGH_WAGE_LABELS } from "@/lib/engine/crs/types";
import { ABILITIES, scoreToClb, TESTS, type TestType } from "@/lib/engine/language";
import { deriveCrs } from "@/lib/profile/derive";
import {
  EDUCATION_LEVELS,
  HIGH_WAGE,
  PROVINCES,
  STATUS_LABELS,
  STATUSES,
  STEPS,
  type Job,
  type LanguageTest,
  type Profile,
  type StepKey,
} from "@/lib/profile/schema";
import { SRC } from "@/lib/sources";
import { Check, Choice, NumberField, SelectField, TextArea, TextField, YES_NO } from "./form/fields";
import { Term } from "./Term";
import { suggestNocAction } from "@/app/actions/noc";
import type { NocMatch } from "@/lib/engine/noc/match";
import { NocResults } from "./NocResults";

const EDU_OPTIONS = EDUCATION_LEVELS.map((e) => [e, EDUCATION_LABELS[e]] as [typeof e, string]);
const WAGE_OPTIONS = HIGH_WAGE.map((w) => [w, HIGH_WAGE_LABELS[w]] as [typeof w, string]);
const ABILITY_LABEL = { listening: "Listening", reading: "Reading", writing: "Writing", speaking: "Speaking" } as const;

export function AssessmentForm({ initial, step, completed, today }: { initial: Profile; step: StepKey; completed: string[]; today: string }) {
  const [p, setP] = useState<Profile>(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saved, setSaved] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();
  const set = <K extends keyof Profile>(k: K, v: Profile[K]) => setP((prev) => ({ ...prev, [k]: v }));
  const idx = STEPS.findIndex((s) => s.key === step);
  const next = STEPS[idx + 1]?.key;
  const prev = STEPS[idx - 1]?.key;

  const on = useMemo(() => new Date(today + "T12:00:00Z"), [today]);
  const live = useMemo(() => {
    const d = deriveCrs(p, on);
    return { ...d, result: d.input ? calculateCrs(d.input, ruleSetFor(on)) : null };
  }, [p, on]);

  function save(goNext: boolean) {
    setSaved(null);
    start(async () => {
      const res = await saveProfileAction(p, step);
      if (!res.ok) {
        setErrors(res.errors ?? {});
        requestAnimationFrame(() => document.querySelector<HTMLElement>("[aria-invalid='true']")?.focus());
        return;
      }
      setErrors({});
      if (goNext && next) router.push(`/assessment?step=${next}`);
      else if (goNext) router.push("/dashboard");
      else setSaved("Saved");
    });
  }

  const partnered = p.maritalStatus === "married" || p.maritalStatus === "common_law";
  const inCanada = p.status && p.status !== "outside_canada";

  return (
    <>
      <nav className="stepper" aria-label="Assessment steps">
        {STEPS.map((s, i) => (
          <Link key={s.key} href={`/assessment?step=${s.key}`} aria-current={s.key === step ? "step" : undefined}>
            <span className="n">{i + 1} of {STEPS.length}</span>
            <span>{s.label}</span>
            {completed.includes(s.key) && <span className="done">Saved</span>}
          </Link>
        ))}
      </nav>

      <div className="qa">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            save(true);
          }}
          noValidate
        >
          {step === "about" && (
            <>
              <section>
                <h2>About you</h2>
                <div className="grid-2">
                  <TextField label="Date of birth" type="date" value={p.dateOfBirth} onChange={(v) => set("dateOfBirth", v)} error={errors.dateOfBirth} hint="Age earns up to 110 CRS points." />
                  <TextField label="Nationality (citizenship)" value={p.nationality} onChange={(v) => set("nationality", v)} autoComplete="country-name" />
                  <TextField label="Country you live in now" value={p.countryOfResidence} onChange={(v) => set("countryOfResidence", v)} autoComplete="country-name" />
                  <NumberField label="Dependent children" min={0} max={20} value={p.children} onChange={(v) => set("children", v)} />
                </div>
              </section>
              <section>
                <h2>Family</h2>
                <SelectField
                  label="Marital status"
                  value={p.maritalStatus}
                  onChange={(v) => set("maritalStatus", v)}
                  options={[["single", "Single, never married"], ["married", "Married"], ["common_law", "Common-law (lived together 12 months or more)"], ["separated", "Legally separated"], ["divorced", "Divorced"], ["widowed", "Widowed"]]}
                />
                {partnered && (
                  <div className="form" style={{ marginTop: "var(--space-lg)" }}>
                    <Choice label="Is your spouse or partner a Canadian citizen or permanent resident?" value={p.spouseIsCitizenOrPr} onChange={(v) => set("spouseIsCitizenOrPr", v)} options={YES_NO} />
                    {p.spouseIsCitizenOrPr !== "yes" && (
                      <Choice label="Will they come to Canada with you?" value={p.spouseAccompanying} onChange={(v) => set("spouseAccompanying", v)} options={YES_NO} hint="This changes how CRS points are split between you." />
                    )}
                    {p.spouseIsCitizenOrPr === "no" && p.spouseAccompanying === "yes" && (
                      <>
                        <div className="grid-2">
                          <SelectField label="Their highest education" value={p.spouseEducation} onChange={(v) => set("spouseEducation", v)} options={EDU_OPTIONS} />
                          <NumberField label="Their years of skilled work in Canada" min={0} max={40} value={p.spouseCanadianWorkYears} onChange={(v) => set("spouseCanadianWorkYears", v)} />
                        </div>
                        <TestEditor title="Their language test (optional)" value={p.spouseTest ?? null} onChange={(t) => set("spouseTest", t)} errors={errors} path="spouseTest" />
                      </>
                    )}
                  </div>
                )}
              </section>
              <section>
                <h2>Relatives in Canada</h2>
                <Choice
                  label="Do you or your accompanying spouse have a brother or sister in Canada who is 18 or older and a citizen or permanent resident?"
                  value={p.siblingInCanada}
                  onChange={(v) => set("siblingInCanada", v)}
                  options={YES_NO}
                  hint="Includes half and step siblings related by blood, marriage, common-law partnership or adoption. Worth 15 points."
                />
                <Choice
                  label="Do you have a parent, grandparent, child, grandchild, aunt, uncle, niece or nephew in Canada who is 18 or older and a citizen or permanent resident?"
                  value={p.relativeInCanada}
                  onChange={(v) => set("relativeInCanada", v)}
                  options={YES_NO}
                  hint="Counts toward Federal Skilled Worker adaptability points."
                />
                <TextArea label="Other relatives in Canada (optional)" value={p.relativesInCanada} onChange={(v) => set("relativesInCanada", v)} hint="Some provincial streams consider close relatives. We'll use this in a later version." />
              </section>
            </>
          )}

          {step === "status" && (
            <>
              <section>
                <h2>Your status today</h2>
                <SelectField
                  label="Which describes you best?"
                  value={p.status}
                  onChange={(v) => set("status", v)}
                  options={STATUSES.map((s) => [s, STATUS_LABELS[s]] as [typeof s, string])}
                />
                {(p.status === "out_of_status" || p.status === "refugee_claimant") && (
                  <p className="notice" style={{ marginTop: "var(--space-md)" }}>
                    <strong>Please talk to a licensed professional.</strong>{" "}
                    {p.status === "out_of_status"
                      ? "If your status expired in the last 90 days you may be able to apply to restore it, and strict rules apply while you wait. "
                      : "Refugee claims follow their own legal process. "}
                    Find a licensed consultant through the <a href={SRC.cicc} target="_blank" rel="noopener noreferrer">College of Immigration and Citizenship Consultants</a>, or a lawyer through your provincial law society.
                  </p>
                )}
              </section>

              {inCanada && (
                <section>
                  <h2>Dates</h2>
                  <div className="grid-2">
                    <TextField label="When did you first arrive in Canada?" type="date" value={p.arrivalDate} onChange={(v) => set("arrivalDate", v)} />
                    {p.status !== "out_of_status" && p.status !== "maintained" && p.status !== "refugee_claimant" && (
                      <>
                        <TextField label="Current permit issue date" type="date" value={p.permitIssueDate} onChange={(v) => set("permitIssueDate", v)} />
                        <TextField label="Current permit expiry date" type="date" value={p.permitExpiryDate} onChange={(v) => set("permitExpiryDate", v)} hint="We'll remind you well before this date." />
                      </>
                    )}
                    {p.status === "maintained" && (
                      <>
                        <TextField label="Date you applied to extend" type="date" value={p.maintainedAppliedDate} onChange={(v) => set("maintainedAppliedDate", v)} />
                        <TextField label="What did you apply for?" value={p.maintainedAppliedFor} onChange={(v) => set("maintainedAppliedFor", v)} hint="For example: PGWP, study permit extension, LMIA work permit." />
                      </>
                    )}
                    {p.status === "out_of_status" && (
                      <TextField label="Date your status expired" type="date" value={p.statusExpiredDate} onChange={(v) => set("statusExpiredDate", v)} />
                    )}
                  </div>
                </section>
              )}

              {p.status === "student" && (
                <section>
                  <h2>Your studies</h2>
                  <div className="grid-2">
                    <TextField label="School" value={p.studyInstitution} onChange={(v) => set("studyInstitution", v)} />
                    <TextField label={<><Term k="dli">DLI</Term> number (optional)</>} value={p.studyDliNumber} onChange={(v) => set("studyDliNumber", v.toUpperCase())} error={errors.studyDliNumber} hint="On your study permit or letter of acceptance. Starts with O." />
                    <TextField label="Program" value={p.studyProgram} onChange={(v) => set("studyProgram", v)} />
                    <TextField label="Expected graduation" type="date" value={p.studyExpectedGraduation} onChange={(v) => set("studyExpectedGraduation", v)} />
                  </div>
                </section>
              )}

              {p.status === "pgwp" && (
                <section>
                  <h2>Your <Term k="pgwp">PGWP</Term></h2>
                  <NumberField label="Length of the program that led to your PGWP, in months" min={0} max={120} value={p.pgwpProgramLengthMonths} onChange={(v) => set("pgwpProgramLengthMonths", v)} hint="A PGWP generally cannot be extended, so the expiry date above drives your planning." />
                </section>
              )}

              {p.status === "closed_work_permit" && (
                <section>
                  <h2>Your work permit</h2>
                  <div className="grid-2">
                    <TextField label="Employer named on the permit" value={p.closedPermitEmployer} onChange={(v) => set("closedPermitEmployer", v)} />
                    <Choice label={<>Was it based on an <Term k="lmia">LMIA</Term>?</>} value={p.closedPermitLmia} onChange={(v) => set("closedPermitLmia", v)} options={YES_NO} />
                  </div>
                </section>
              )}

              <section>
                <h2>Your history</h2>
                <div className="form">
                  <TextArea label="Previous permits or visas for Canada (optional)" value={p.previousPermits} onChange={(v) => set("previousPermits", v)} />
                  <Choice label="Has any Canadian application of yours ever been refused?" value={p.previousRefusals} onChange={(v) => set("previousRefusals", v)} options={YES_NO} />
                  {p.previousRefusals === "yes" && <TextArea label="What was refused, and when?" value={p.previousRefusalsDetails} onChange={(v) => set("previousRefusalsDetails", v)} />}
                  <Choice label="Have you ever applied to restore your status?" value={p.previousRestoration} onChange={(v) => set("previousRestoration", v)} options={YES_NO} />
                  <Choice label="Have you ever overstayed, worked or studied without authorization, or been asked to leave Canada?" value={p.previousViolations} onChange={(v) => set("previousViolations", v)} options={YES_NO} />
                  {p.previousViolations === "yes" && <TextArea label="Tell us briefly what happened" value={p.previousViolationsDetails} onChange={(v) => set("previousViolationsDetails", v)} hint="This stays encrypted. We'll recommend professional advice, as these can affect admissibility." />}
                  <TextArea label="Other immigration applications you have made (optional)" value={p.previousApplications} onChange={(v) => set("previousApplications", v)} />
                </div>
              </section>
            </>
          )}

          {step === "education" && (
            <>
              <section>
                <h2>Your highest education</h2>
                <div className="form">
                  <SelectField label="Highest completed credential" value={p.educationLevel} onChange={(v) => set("educationLevel", v)} options={EDU_OPTIONS} />
                  <Choice label="Where did you earn it?" value={p.educationEarnedIn} onChange={(v) => set("educationEarnedIn", v)} options={[["canada", "In Canada"], ["foreign", "Outside Canada"], ["both", "I have credentials from both"]]} />
                  {(p.educationEarnedIn === "foreign" || p.educationEarnedIn === "both") && (
                    <>
                      <Choice label={<>Do you have an <Term k="eca">ECA</Term> for your foreign education?</>} value={p.ecaStatus} onChange={(v) => set("ecaStatus", v)} options={[["none", "No"], ["in_progress", "Applied, waiting"], ["completed", "Yes, I have the report"]]} />
                      {p.ecaStatus === "completed" && (
                        <div className="grid-2">
                          <SelectField label="Canadian equivalent on the ECA report" value={p.ecaEquivalent} onChange={(v) => set("ecaEquivalent", v)} options={EDU_OPTIONS} />
                          <TextField label="Date of the ECA report" type="date" value={p.ecaDate} onChange={(v) => set("ecaDate", v)} hint="Must be under 5 years old when you create your profile and when you apply." />
                        </div>
                      )}
                    </>
                  )}
                </div>
              </section>
              {(p.educationEarnedIn === "canada" || p.educationEarnedIn === "both" || p.status === "student" || p.status === "pgwp") && (
                <section>
                  <h2>Your Canadian studies</h2>
                  <div className="grid-2">
                    <TextField label="School" value={p.canadianInstitution} onChange={(v) => set("canadianInstitution", v)} />
                    <Choice label={<>Was it a <Term k="dli">DLI</Term>?</>} value={p.canadianInstitutionIsDli} onChange={(v) => set("canadianInstitutionIsDli", v)} options={YES_NO} />
                    <TextField label="Program name" value={p.canadianProgram} onChange={(v) => set("canadianProgram", v)} />
                    <SelectField
                      label="Credential"
                      value={p.canadianCredentialType}
                      onChange={(v) => set("canadianCredentialType", v)}
                      options={[["certificate", "Certificate"], ["diploma", "Diploma"], ["advanced_diploma", "Advanced diploma"], ["bachelors", "Bachelor's degree"], ["postgrad_certificate", "Post-graduate certificate"], ["masters", "Master's degree"], ["doctoral", "Doctoral degree"], ["other", "Other"]]}
                    />
                    <NumberField label="Program length in months" min={0} max={120} value={p.canadianProgramLengthMonths} onChange={(v) => set("canadianProgramLengthMonths", v)} />
                    <TextField label="Graduation date (or expected)" type="date" value={p.canadianGraduationDate} onChange={(v) => set("canadianGraduationDate", v)} />
                    <Choice label="Did you study full-time the whole program?" value={p.canadianStudyFullTime} onChange={(v) => set("canadianStudyFullTime", v)} options={YES_NO} />
                    <Choice label="Did you study in person, in Canada, for at least 8 months?" value={p.canadianStudyInPerson} onChange={(v) => set("canadianStudyInPerson", v)} options={YES_NO} />
                  </div>
                </section>
              )}
              <section>
                <h2>Trades</h2>
                <Choice label="Do you hold a certificate of qualification in a trade, issued by a Canadian province or territory?" value={p.certificateOfQualification} onChange={(v) => set("certificateOfQualification", v)} options={YES_NO} />
              </section>
            </>
          )}

          {step === "language" && (
            <>
              <section>
                <h2>English test</h2>
                <TestEditor title="" kinds={["ielts_gt", "celpip_g", "pte_core"]} value={p.englishTest ?? null} onChange={(t) => set("englishTest", t)} errors={errors} path="englishTest" />
              </section>
              <section>
                <h2>French test</h2>
                <TestEditor title="" kinds={["tef_canada", "tcf_canada"]} value={p.frenchTest ?? null} onChange={(t) => set("frenchTest", t)} errors={errors} path="frenchTest" />
              </section>
              <p className="small muted" style={{ marginTop: "var(--space-lg)" }}>
                Scores convert to <Term k="clb">CLB or NCLC</Term> levels using{" "}
                <a href={SRC.languageTests} target="_blank" rel="noopener noreferrer">IRCC&apos;s equivalency charts</a>.
              </p>
            </>
          )}

          {step === "work" && (
            <>
              <section>
                <h2>Your jobs</h2>
                <p className="small muted" style={{ marginBottom: "var(--space-lg)", maxWidth: "62ch" }}>
                  Add every paid job from the last 10 years, in Canada and abroad. Express Entry counts skilled work (<Term k="teer">TEER</Term> 0 to 3) by hours: 30 hours a week for a year is one year, and hours over 30 a week don&apos;t add more.
                </p>
                {(p.jobs ?? []).map((job, i) => (
                  <JobEditor
                    key={job.id}
                    job={job}
                    index={i}
                    errors={errors}
                    wasStudent={p.status === "student" || p.status === "pgwp"}
                    onChange={(j) => set("jobs", (p.jobs ?? []).map((x) => (x.id === j.id ? j : x)))}
                    onRemove={() => set("jobs", (p.jobs ?? []).filter((x) => x.id !== job.id))}
                  />
                ))}
                <div className="actions" style={{ marginTop: "var(--space-lg)" }}>
                  <button type="button" className="btn btn--card" onClick={() => set("jobs", [...(p.jobs ?? []), { id: crypto.randomUUID().slice(0, 12), country: "canada", paid: true }])}>
                    Add a job
                  </button>
                </div>
              </section>
              <section>
                <h2>Job offer</h2>
                <div className="form">
                  <Choice
                    label="Do you have a full-time job offer in Canada for at least one year, not seasonal, in writing?"
                    value={p.jobOfferValid}
                    onChange={(v) => set("jobOfferValid", v)}
                    options={YES_NO}
                  />
                  {p.jobOfferValid === "yes" && (
                    <div className="grid-2">
                      <SelectField label={<><Term k="teer">TEER</Term> of the job offered</>} value={p.jobOfferTeer} onChange={(v) => set("jobOfferTeer", v)} options={[["0", "TEER 0"], ["1", "TEER 1"], ["2", "TEER 2"], ["3", "TEER 3"], ["4", "TEER 4"], ["5", "TEER 5"], ["unknown", "I don't know"]]} />
                      <SelectField label="Province or territory of the job" value={p.jobOfferProvince as never} onChange={(v) => set("jobOfferProvince", v)} options={PROVINCES.map((x) => [x, x] as [string, string])} />
                    </div>
                  )}
                </div>
              </section>
              <section>
                <h2>High-wage job offer</h2>
                <SelectField
                  label={<>Do you have a job offer in a <Term k="high_wage">high-wage occupation</Term>?</>}
                  value={p.jobOfferHighWage}
                  onChange={(v) => set("jobOfferHighWage", v)}
                  options={WAGE_OPTIONS}
                  placeholder="No job offer"
                  hint={<>Since November 3, 2026 an LMIA is no longer needed. Check your occupation on <a href={SRC.highWage} target="_blank" rel="noopener noreferrer">IRCC&apos;s high-wage list</a>; the offer must also be valid under Express Entry.</>}
                />
              </section>
            </>
          )}

          {step === "location" && (
            <>
              <section>
                <h2>Where you live</h2>
                <div className="grid-2">
                  <SelectField label="Province or territory" value={p.province as never} onChange={(v) => set("province", v)} options={PROVINCES.map((x) => [x, x] as [string, string])} placeholder="Outside Canada, or choose" />
                  <TextField label="City or town" value={p.city} onChange={(v) => set("city", v)} autoComplete="address-level2" />
                </div>
              </section>
              <section>
                <h2>Where you&apos;d live</h2>
                <div className="form">
                  <Choice label="Would you move to another province for permanent residence?" value={p.willingToRelocate} onChange={(v) => set("willingToRelocate", v)} options={YES_NO} />
                  <fieldset className="field">
                    <legend className="label">Provinces you&apos;d consider</legend>
                    <div className="grid-2">
                      {PROVINCES.map((prov) => (
                        <Check
                          key={prov}
                          checked={p.preferredProvinces?.includes(prov)}
                          onChange={(c) => set("preferredProvinces", c ? [...(p.preferredProvinces ?? []), prov] : (p.preferredProvinces ?? []).filter((x) => x !== prov))}
                        >
                          {prov}
                        </Check>
                      ))}
                    </div>
                  </fieldset>
                  <Choice label="Would you live and work in a smaller or rural community?" value={p.ruralOk} onChange={(v) => set("ruralOk", v)} options={YES_NO} hint="Some community pilots only accept people who commit to living there." />
                  <Choice label="Would you learn French?" value={p.learnFrench} onChange={(v) => set("learnFrench", v)} options={YES_NO} hint="NCLC 7 in French can add up to 50 points and opens French-language category rounds." />
                  <NumberField
                    label="Money you could show for settling in Canada, in Canadian dollars (optional)"
                    min={0}
                    value={p.settlementFunds}
                    onChange={(v) => set("settlementFunds", v)}
                    hint="Savings you can access, not borrowed money or home equity. Some programs ask for proof unless you work in Canada with a job offer."
                  />
                  <Choice label={<>Do you already have a provincial or territorial nomination (<Term k="pnp">PNP</Term>) through an Express Entry stream?</>} value={p.provincialNomination} onChange={(v) => set("provincialNomination", v)} options={YES_NO} />
                </div>
              </section>
            </>
          )}

          {errors._ && <p className="notice notice--error">{errors._}</p>}
          {Object.keys(errors).length > 0 && !errors._ && (
            <p className="notice notice--error" role="alert">Some answers need fixing before we can save. They are marked above.</p>
          )}

          <div className="savebar">
            <div className="actions">
              {prev && <Link className="btn btn--card" href={`/assessment?step=${prev}`}>Back</Link>}
              <button type="button" className="btn btn--card" onClick={() => save(false)} disabled={pending}>Save</button>
              <span className="small muted" aria-live="polite">{pending ? "Saving" : saved}</span>
            </div>
            <button type="submit" className="btn btn--ink" disabled={pending} aria-busy={pending}>
              {next ? "Save and continue" : "Save and see dashboard"}
            </button>
          </div>
        </form>

        <aside className="qa__aside" aria-label="Your estimate so far">
          <div className="stock panel">
            <p className="label"><Term k="crs">CRS</Term> estimate so far</p>
            <p className="total-fig" style={{ marginTop: "var(--space-xs)" }}>{live.result ? live.result.total : "Not yet"}</p>
            <p className="small muted" style={{ marginTop: "var(--space-xs)" }}>
              {live.result ? `Rules in effect ${live.result.ruleSetVersion}. Updates as you type.` : "Add your date of birth and education to see a score."}
            </p>
          </div>
          {live.missing.length > 0 && (
            <div className="stock panel">
              <p className="label">Still missing</p>
              <ul className="list small">
                {live.missing.slice(0, 5).map((m, i) => (
                  <li key={i}>{m.message}</li>
                ))}
              </ul>
            </div>
          )}
        </aside>
      </div>
    </>
  );
}

function TestEditor({ title, value, onChange, kinds, errors, path }: {
  title: string;
  value: LanguageTest | null;
  onChange: (t: LanguageTest | null) => void;
  kinds?: TestType[];
  errors: Record<string, string>;
  path: string;
}) {
  const options = (kinds ?? (Object.keys(TESTS) as TestType[])).map((k) => [k, TESTS[k].label] as [TestType, string]);
  if (!value) {
    return (
      <div className="form">
        {title && <p className="label">{title}</p>}
        <SelectField label="Test" value={undefined} onChange={(t) => t && onChange({ type: t, date: "", listening: 0, reading: 0, writing: 0, speaking: 0 })} options={options} placeholder="I haven't taken one" />
      </div>
    );
  }
  const spec = TESTS[value.type];
  return (
    <div className="form">
      {title && <p className="label">{title}</p>}
      <div className="grid-2">
        <SelectField label="Test" value={value.type} onChange={(t) => onChange(t ? { ...value, type: t } : null)} options={options} placeholder="Remove this test" />
        <TextField label="Test date" type="date" value={value.date} onChange={(d) => onChange({ ...value, date: d })} hint="Results are valid for 2 years." />
      </div>
      <div className="grid-4">
        {ABILITIES.map((a) => {
          let level: string;
          try {
            const l = scoreToClb(value.type, a, value[a]);
            level = l === 0 ? `Below ${spec.language === "french" ? "NCLC" : "CLB"} 4` : `${spec.language === "french" ? "NCLC" : "CLB"} ${l}`;
          } catch {
            level = `Enter ${spec.range[a][0]} to ${spec.range[a][1]}`;
          }
          return (
            <NumberField
              key={a}
              label={ABILITY_LABEL[a]}
              step={spec.step}
              min={spec.range[a][0]}
              max={spec.range[a][1]}
              value={value[a]}
              onChange={(n) => onChange({ ...value, [a]: n ?? 0 })}
              hint={level}
              error={errors[`${path}.${a}`]}
            />
          );
        })}
      </div>
      {spec.note && <p className="hint">{spec.note}</p>}
    </div>
  );
}

function JobEditor({ job, index, onChange, onRemove, errors, wasStudent }: {
  job: Job;
  index: number;
  onChange: (j: Job) => void;
  onRemove: () => void;
  errors: Record<string, string>;
  wasStudent: boolean;
}) {
  const up = <K extends keyof Job>(k: K, v: Job[K]) => onChange({ ...job, [k]: v });
  const err = (k: string) => errors[`jobs.${index}.${k}`];
  return (
    <div className="stock job">
      <div className="job__head">
        <h3>{job.title || `Job ${index + 1}`}</h3>
        <button type="button" className="btn btn--card btn--sm btn--danger" onClick={onRemove}>Remove</button>
      </div>
      <div className="grid-2">
        <TextField label="Job title" value={job.title} onChange={(v) => up("title", v)} />
        <TextField label="Employer" value={job.employer} onChange={(v) => up("employer", v)} />
        <Choice label="Where?" value={job.country} onChange={(v) => up("country", v)} options={[["canada", "In Canada"], ["foreign", "Outside Canada"]]} />
        {job.country === "canada" && (
          <SelectField label="Province or territory" value={job.province as never} onChange={(v) => up("province", v)} options={PROVINCES.map((x) => [x, x] as [string, string])} />
        )}
        <TextField label="Start date" type="date" value={job.startDate} onChange={(v) => up("startDate", v)} />
        {!job.current && <TextField label="End date" type="date" value={job.endDate} onChange={(v) => up("endDate", v)} />}
        <NumberField label="Hours a week" min={0} max={100} value={job.hoursPerWeek} onChange={(v) => up("hoursPerWeek", v)} />
        <SelectField
          label={<><Term k="teer">TEER</Term> category</>}
          value={job.teer}
          onChange={(v) => up("teer", v)}
          options={[["0", "TEER 0 (management)"], ["1", "TEER 1 (usually a degree)"], ["2", "TEER 2 (college, apprenticeship 2+ years)"], ["3", "TEER 3 (college under 2 years, apprenticeship)"], ["4", "TEER 4 (high school, job training)"], ["5", "TEER 5 (short demonstration)"], ["unknown", "I don't know yet"]]}
          hint={<>The second digit of your <a href={SRC.noc} target="_blank" rel="noopener noreferrer">NOC code</a>. Match it to your duties, not your title.</>}
        />
        <TextField label="NOC 2021 code (optional)" value={job.nocCode} onChange={(v) => up("nocCode", v.replace(/\D/g, "").slice(0, 5))} inputMode="numeric" error={err("nocCode")} />
        {job.country === "canada" && (
          <SelectField label={<>Is this occupation on IRCC&apos;s <Term k="high_wage">high-wage list</Term>?</>} value={job.highWage} onChange={(v) => up("highWage", v)} options={WAGE_OPTIONS} placeholder="Not on the list, or I don't know" />
        )}
        <Choice label="Can you get a reference letter from this employer?" value={job.hasReferenceLetter} onChange={(v) => up("hasReferenceLetter", v)} options={YES_NO} />
      </div>
      <div className="form" style={{ gap: "var(--space-xs)" }}>
        <Check checked={job.current} onChange={(v) => up("current", v)}>I still work here</Check>
        <Check checked={job.paid !== false} onChange={(v) => up("paid", v)}>This job was paid (wages or commission)</Check>
        <Check checked={job.selfEmployed} onChange={(v) => up("selfEmployed", v)}>I was self-employed</Check>
        {job.country === "canada" && wasStudent && (
          <Check checked={job.whileFullTimeStudent} onChange={(v) => up("whileFullTimeStudent", v)}>I did this work while I was a full-time student</Check>
        )}
      </div>
      <TextArea
        label="Your main duties"
        value={job.duties}
        onChange={(v) => up("duties", v)}
        hint="Write what you actually did, in your own words. Your NOC code depends on these duties, not your title."
      />
      <DutyMatcher job={job} onPick={(code, teer) => onChange({ ...job, nocCode: code, teer: String(teer) as Job["teer"] })} />
    </div>
  );
}

function DutyMatcher({ job, onPick }: { job: Job; onPick: (code: string, teer: number) => void }) {
  const [res, setRes] = useState<NocMatch | null>(null);
  const [pending, start] = useTransition();
  return (
    <div className="form" style={{ gap: "var(--space-sm)" }}>
      <div className="actions">
        <button type="button" className="btn btn--card btn--sm" disabled={pending} aria-busy={pending} onClick={() => start(async () => setRes(await suggestNocAction(job.duties ?? "", job.title ?? "", 3)))}>
          {pending ? "Comparing" : "Suggest NOC codes from these duties"}
        </button>
      </div>
      {res && (
        <NocResults
          result={res}
          onPick={(code, teer) => {
            onPick(code, teer);
            setRes(null);
          }}
        />
      )}
    </div>
  );
}
