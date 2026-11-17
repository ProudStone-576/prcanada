/**
 * Temporary status assessments: PGWP, spousal open work permit, bridging open
 * work permit, and a status check. Rules read from canada.ca and the Justice
 * Laws site on 2026-11-17 (pages dated 2026-03 to 2026-10). Pure.
 */
import { minClb, scoresToClb, type ClbLevels } from "./language";
import type { Requirement, Verdict } from "./eligibility/express-entry";
import { overall } from "./eligibility/express-entry";

export const TEMP_VERIFIED = "2026-11-17";
const IRCC = "https://www.canada.ca/en/immigration-refugees-citizenship/services";
export const TEMP_SOURCES = {
  pgwpAbout: `${IRCC}/study-canada/work/after-graduation/about.html`,
  pgwpEligibility: `${IRCC}/study-canada/work/after-graduation/eligibility.html`,
  pgwpLanguage: `${IRCC}/study-canada/work/after-graduation/eligibility/language-results.html`,
  pgwpField: `${IRCC}/study-canada/work/after-graduation/eligibility/field-of-study.html`,
  pgwpAfter: `${IRCC}/study-canada/work/after-graduation/after-you-apply.html`,
  spouseStudent: `${IRCC}/study-canada/work/help-your-spouse-common-law-partner-work-canada.html`,
  spouseWorker: `${IRCC}/work-canada/special-instructions/spouses-dependent-children/eligibility.html`,
  bowp: `${IRCC}/work-canada/pr-work-permits/bridging.html`,
  extendWork: `${IRCC}/work-canada/extend/apply.html`,
  extendStudy: `${IRCC}/study-canada/extend-study-permit/when-to-apply.html`,
  restoreWork: `${IRCC}/work-canada/restore.html`,
  restoreStudy: `${IRCC}/study-canada/extend-study-permit/expired-permit.html`,
  vulnerable: `${IRCC}/work-canada/special-instructions/vulnerable-workers.html`,
};

export interface TempResult {
  id: string;
  name: string;
  verdict: Verdict;
  requirements: Requirement[];
  notes: string[];
  sourceUrl: string;
  extra?: { lengthMonths?: number | null; lengthNote?: string };
}

const req = (key: string, label: string, verdict: Verdict, detail: string): Requirement => ({ key, label, verdict, detail });
const yn = (v: string | undefined, yesDetail: string, noDetail: string, unknownDetail: string): [Verdict, string] =>
  v === "yes" ? ["meets", yesDetail] : v === "no" ? ["not_met", noDetail] : ["needs_info", unknownDetail];

export type Credential = "bachelors" | "masters" | "doctoral" | "other_university" | "college" | "flight_school";

export interface PgwpInput {
  credential?: Credential;
  programMonths?: number;
  dliPgwpEligible?: "yes" | "no" | "unsure";
  fullTimeEachTerm?: "yes" | "no" | "unsure";
  atLeastHalfInClassInCanada?: "yes" | "no" | "unsure";
  completionConfirmedOn?: string; // date the school confirmed completion
  studyPermitValidInWindow?: "yes" | "no" | "unsure";
  hadPgwpBefore?: "yes" | "no";
  fieldOfStudyEligible?: "yes" | "no" | "unsure";
  studyPermitAppliedOnOrAfterNov2024?: "yes" | "no" | "unsure";
  passportExpiry?: string;
  language?: ClbLevels | null;
}

const DAY = 86400_000;

export function pgwpLength(credential: Credential | undefined, months: number | undefined): { months: number | null; note: string } {
  if (!months || months < 8) return { months: null, note: "Programs under 8 months don't lead to a PGWP." };
  if (credential === "masters") return { months: 36, note: "A master's program of at least 8 months can lead to a 3-year PGWP (since February 15, 2024)." };
  if (months >= 24) return { months: 36, note: "A program of 2 years or more can lead to a 3-year PGWP." };
  return { months, note: `A program of at least 8 months but under 2 years leads to a PGWP up to the length of the program, here about ${months} months.` };
}

export function assessPgwp(i: PgwpInput, on: Date): TempResult {
  const r: Requirement[] = [];
  r.push(i.hadPgwpBefore === "yes" ? req("once", "Never had a PGWP before", "not_met", "You can only get one PGWP in your lifetime.") : i.hadPgwpBefore === "no" ? req("once", "Never had a PGWP before", "meets", "") : req("once", "Never had a PGWP before", "needs_info", "Tell us whether you've had one."));
  r.push(!i.programMonths ? req("length", "Program at least 8 months", "needs_info", "Add your program length.") : i.programMonths >= 8 ? req("length", "Program at least 8 months", "meets", `${i.programMonths} months.`) : req("length", "Program at least 8 months", "not_met", `${i.programMonths} months is too short.`));
  r.push(req("dli", "School and program eligible for a PGWP", ...yn(i.dliPgwpEligible, "Your school confirms the program is PGWP-eligible.", "The program isn't PGWP-eligible.", "Check that your school is a DLI with PGWP-eligible programs; not all are.")));
  r.push(req("fulltime", "Full-time in every term (part-time allowed only in the last term)", ...yn(i.fullTimeEachTerm, "", "Part-time terms before the last one usually make you ineligible, unless it was authorized leave.", "Check your enrolment history.")));
  r.push(req("inclass", "At least half the program studied in class in Canada", ...yn(i.atLeastHalfInClassInCanada, "", "Over 50% by distance learning makes you ineligible.", "Tell us how much was online.")));

  if (i.completionConfirmedOn) {
    const deadline = new Date(new Date(i.completionConfirmedOn + "T00:00:00Z").getTime() + 180 * DAY).toISOString().slice(0, 10);
    const late = deadline < on.toISOString().slice(0, 10);
    r.push(req("deadline", "Apply within 180 days of your school confirming completion", late ? "not_met" : "meets", late ? `The 180 days ended on ${deadline}.` : `Apply by ${deadline}.`));
  } else r.push(req("deadline", "Apply within 180 days of your school confirming completion", "needs_info", "Add the date your school confirmed you completed the program."));
  r.push(req("permit", "Study permit valid at some point in those 180 days", ...yn(i.studyPermitValidInWindow, "", "Without a valid study permit in that window you're not eligible.", "Check your study permit's expiry date.")));

  const needClb = i.credential === "flight_school" ? null : i.credential === "college" ? 5 : 7;
  if (needClb === null) r.push(req("language", "Language results", "meets", "Flight school graduates don't need language results."));
  else if (!i.credential) r.push(req("language", "Language: CLB 7 for university programs, CLB 5 for college", "needs_info", "Tell us your type of program."));
  else if (!i.language) r.push(req("language", `Language: CLB/NCLC ${needClb} in all four abilities`, "needs_info", "Applications since November 1, 2024 need approved test results."));
  else r.push(req("language", `Language: CLB/NCLC ${needClb} in all four abilities`, minClb(i.language) >= needClb ? "meets" : "not_met", `Your lowest ability is level ${minClb(i.language)}.`));

  const fieldRequired = i.credential === "college" || i.credential === "other_university";
  if (fieldRequired) {
    if (i.studyPermitAppliedOnOrAfterNov2024 === "no") r.push(req("field", "Eligible field of study", "meets", "Not required: your study permit application was before November 1, 2024."));
    else if (i.studyPermitAppliedOnOrAfterNov2024 === "yes") r.push(req("field", "Eligible field of study", ...yn(i.fieldOfStudyEligible, "Your program's code is on IRCC's list.", "Your program's field isn't on IRCC's eligible list.", "Check your program's CIP code against IRCC's current list.")));
    else r.push(req("field", "Eligible field of study", "needs_info", "Needed if you applied for your study permit on or after November 1, 2024."));
  }

  const len = pgwpLength(i.credential, i.programMonths);
  let lengthNote = len.note;
  if (len.months && i.passportExpiry) lengthNote += " It can't run past your passport's expiry date, so renew your passport first if it expires sooner.";
  return {
    id: "pgwp",
    name: "Post-graduation work permit",
    verdict: overall(r),
    requirements: r,
    notes: [
      "While waiting, you can work full-time if your study permit was valid when you applied, you finished your program, and you were allowed to work off campus while studying.",
      "A PGWP generally can't be extended, except when your passport expired before the full length you were eligible for.",
      "Some programs are excluded, such as ESL, general interest and most curriculum licensing programs.",
    ],
    sourceUrl: TEMP_SOURCES.pgwpEligibility,
    extra: { lengthMonths: len.months, lengthNote },
  };
}

export interface SpouseInput {
  principal: "student" | "worker";
  studentProgram?: "masters_16plus" | "doctoral" | "professional" | "other";
  workerTeer?: "0" | "1" | "2" | "3" | "4" | "5";
  monthsLeftOnPermit?: number;
  workerOnPrPathway?: "yes" | "no" | "unsure";
}

export function assessSpousalOwp(i: SpouseInput): TempResult {
  const r: Requirement[] = [];
  const notes: string[] = [];
  if (i.principal === "student") {
    const ok = i.studentProgram === "masters_16plus" || i.studentProgram === "doctoral" || i.studentProgram === "professional";
    r.push(
      !i.studentProgram
        ? req("program", "Partner studies in an eligible program", "needs_info", "Which program is your partner in?")
        : req("program", "Partner studies in an eligible program", ok ? "meets" : "not_met", ok ? "Master's of 16 months or more, doctoral, and listed professional degrees qualify." : "Since January 21, 2025, only master's programs of 16 months or more, doctoral programs, some professional degrees and eligible pilots qualify."),
    );
    r.push(req("permit", "Partner has a valid study permit", "needs_info", "Your permit usually matches the length of theirs."));
    notes.push("Professional degrees on the list include Doctor of Medicine, law (LLB, JD, BCL) and engineering (BEng, BE, BASc), among others.");
  } else {
    const t = i.workerTeer;
    if (!t) r.push(req("occupation", "Partner's occupation qualifies", "needs_info", "What TEER is your partner's job?"));
    else if (t === "0" || t === "1") r.push(req("occupation", "Partner's occupation qualifies", "meets", "TEER 0 and 1 occupations qualify."));
    else if (t === "2" || t === "3") r.push(req("occupation", "Partner's occupation qualifies", "needs_info", "Only select TEER 2 and 3 occupations qualify; check IRCC's list."));
    else r.push(req("occupation", "Partner's occupation qualifies", i.workerOnPrPathway === "yes" ? "needs_info" : "not_met", "TEER 4 and 5 workers' partners qualify only through certain permanent residence pathway streams."));
    const need = t === "4" || t === "5" ? 6 : 16;
    r.push(
      i.monthsLeftOnPermit === undefined
        ? req("time", `Partner's permit valid at least ${need} more months`, "needs_info", "Measured from when IRCC receives your application.")
        : req("time", `Partner's permit valid at least ${need} more months`, i.monthsLeftOnPermit >= need ? "meets" : "not_met", `${i.monthsLeftOnPermit} months left.`),
    );
    notes.push("Since January 21, 2025, dependent children of high-skilled workers no longer qualify for their own open work permits.");
  }
  return { id: "sowp", name: "Open work permit for a spouse or partner", verdict: overall(r), requirements: r, notes, sourceUrl: i.principal === "student" ? TEMP_SOURCES.spouseStudent : TEMP_SOURCES.spouseWorker };
}

export interface BowpInput {
  prProgram?: "express_entry" | "pnp" | "quebec" | "other" | "none";
  principalApplicant?: "yes" | "no";
  inCanada?: "yes" | "no";
  aorReceived?: "yes" | "no";
  status?: "valid_permit" | "maintained" | "can_restore" | "other";
}

export function assessBowp(i: BowpInput): TempResult {
  const r: Requirement[] = [];
  r.push(
    !i.prProgram || i.prProgram === "none"
      ? req("program", "PR application in an eligible program", i.prProgram === "none" ? "not_met" : "needs_info", "Express Entry (CEC, FSW, FST), Provincial Nominee Program and some Quebec and caregiver classes qualify.")
      : req("program", "PR application in an eligible program", i.prProgram === "other" ? "needs_info" : "meets", i.prProgram === "other" ? "Check whether your program is on IRCC's list; Home Care Worker pilots are not." : ""),
  );
  r.push(req("principal", "You're the principal applicant", i.principalApplicant === "yes" ? "meets" : i.principalApplicant === "no" ? "not_met" : "needs_info", ""));
  r.push(req("canada", "You live in Canada", i.inCanada === "yes" ? "meets" : i.inCanada === "no" ? "not_met" : "needs_info", ""));
  r.push(req("aor", "Your PR application passed the completeness check (you have an acknowledgement of receipt)", i.aorReceived === "yes" ? "meets" : i.aorReceived === "no" ? "not_met" : "needs_info", ""));
  r.push(
    req("status", "Valid work permit, maintained status as a worker, or eligible to restore", i.status && i.status !== "other" ? "meets" : i.status === "other" ? "not_met" : "needs_info", "You must also be in Canada with valid status when IRCC decides."),
  );
  return { id: "bowp", name: "Bridging open work permit", verdict: overall(r), requirements: r, notes: ["If your permit expires while you're outside Canada, you can't work until the new permit is approved."], sourceUrl: TEMP_SOURCES.bowp };
}

export interface StatusAdvice {
  title: string;
  detail: string;
  urgent: boolean;
  url: string;
}

/** What the person's current status means for staying, working and studying. */
export function statusCheck(status: string | undefined, permitExpiry: string | undefined, expiredOn: string | undefined, on: Date): StatusAdvice[] {
  const out: StatusAdvice[] = [];
  const today = on.toISOString().slice(0, 10);
  const daysTo = (iso: string) => Math.ceil((new Date(iso + "T00:00:00Z").getTime() - on.getTime()) / DAY);
  if (permitExpiry && ["student", "pgwp", "closed_work_permit", "open_work_permit", "visitor"].includes(status ?? "")) {
    const n = daysTo(permitExpiry);
    if (n >= 0) {
      out.push({
        title: n <= 30 ? `Your permit expires in ${n} days` : `Your permit expires on ${permitExpiry}`,
        detail:
          status === "student"
            ? "IRCC asks you to apply to extend at least 30 days before it expires. If you apply before it expires, you can keep studying under the same conditions while you wait, as long as you stay in Canada."
            : "IRCC asks you to apply at least 30 days before it expires. If your application arrives before midnight UTC on the expiry date, you can stay and keep working under the same conditions while IRCC decides (maintained status). On maintained status you can't renew a SIN or some provincial cards.",
        urgent: n <= 60,
        url: status === "student" ? TEMP_SOURCES.extendStudy : TEMP_SOURCES.extendWork,
      });
      if (status === "pgwp") out.push({ title: "PGWPs generally can't be extended", detail: "Plan your next permit or permanent residence before it ends: for example a bridging open work permit after a PR application, or an employer-specific permit.", urgent: n <= 180, url: TEMP_SOURCES.pgwpAbout });
    }
  }
  if (status === "maintained") out.push({ title: "You're on maintained status", detail: "You can stay and keep working or studying under your old permit's conditions until IRCC decides. If IRCC refuses the application, maintained status ends; check your options right away.", urgent: false, url: TEMP_SOURCES.extendWork });
  if (status === "out_of_status") {
    const deadline = expiredOn ? new Date(new Date(expiredOn + "T00:00:00Z").getTime() + 90 * DAY).toISOString().slice(0, 10) : null;
    out.push({
      title: deadline && deadline >= today ? `Restoration deadline: ${deadline}` : "Restoration has a 90-day limit",
      detail: "IRCC must receive a restoration application no more than 90 days after your status expired (IRPR s. 182 covers visitors, workers and students in the situations it lists). While waiting you normally can't work or study. If it's refused, you must leave Canada. Get professional advice now.",
      urgent: true,
      url: TEMP_SOURCES.restoreWork,
    });
  }
  out.push({ title: "If you face abuse at work", detail: "Workers on employer-specific permits who are being abused, or are at risk of abuse, in their job may qualify for an open work permit for vulnerable workers.", urgent: false, url: TEMP_SOURCES.vulnerable });
  return out;
}

export function languageFromTest(t: { type: Parameters<typeof scoresToClb>[0]; listening: number; reading: number; writing: number; speaking: number } | null | undefined): ClbLevels | null {
  if (!t) return null;
  try {
    return scoresToClb(t.type, t);
  } catch {
    return null;
  }
}
