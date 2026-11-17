/**
 * Pure functions that turn questionnaire answers into engine input, missing
 * information and deadlines. No I/O, so they run on the server and in tests.
 */
import { scoresToClb, testIsValid, TESTS, type ClbLevels } from "../engine/language";
import type { CanadianEducation, CrsInput, EducationLevel, HighWageLevel } from "../engine/crs/types";
import type { Job, LanguageTest, Profile, StepKey } from "./schema";

export interface Missing {
  step: StepKey;
  message: string;
}

export interface DerivedCrs {
  input: CrsInput | null;
  missing: Missing[];
  notes: string[];
  canadianWorkYears: number;
  foreignWorkYears: number;
}

const DAY = 86400_000;
const HOURS_PER_YEAR = 1560; // 30 hours a week for 52 weeks
const WEEKLY_CAP = 30; // hours over 30 a week do not add experience

export function ageOn(dob: string, on: Date): number {
  const d = new Date(dob + "T00:00:00Z");
  let age = on.getUTCFullYear() - d.getUTCFullYear();
  const beforeBirthday =
    on.getUTCMonth() < d.getUTCMonth() || (on.getUTCMonth() === d.getUTCMonth() && on.getUTCDate() < d.getUTCDate());
  if (beforeBirthday) age -= 1;
  return age;
}

const parse = (s?: string) => (s ? new Date(s + "T00:00:00Z") : null);

/**
 * Credited hours of experience in the 10 years before `on`, counting each week
 * at most 30 hours across all overlapping jobs so concurrent jobs are never
 * double counted.
 */
export function creditedHours(jobs: Job[], on: Date): number {
  const windowStart = new Date(on.getTime() - 3652 * DAY);
  const weeks = Math.ceil((on.getTime() - windowStart.getTime()) / (7 * DAY));
  const perWeek = new Float64Array(weeks);
  for (const job of jobs) {
    const start = parse(job.startDate);
    const end = job.current ? on : parse(job.endDate);
    if (!start || !end || end <= start || !job.hoursPerWeek) continue;
    const from = Math.max(start.getTime(), windowStart.getTime());
    const to = Math.min(end.getTime(), on.getTime());
    for (let t = from; t < to; t += DAY) {
      const w = Math.floor((t - windowStart.getTime()) / (7 * DAY));
      if (w >= 0 && w < weeks) perWeek[w] += job.hoursPerWeek / 7;
    }
  }
  let total = 0;
  for (const h of perWeek) total += Math.min(WEEKLY_CAP, h);
  return total;
}

const isSkilled = (j: Job) => j.teer === "0" || j.teer === "1" || j.teer === "2" || j.teer === "3";

function countsInCanada(j: Job) {
  return j.country === "canada" && isSkilled(j) && j.paid !== false && !j.selfEmployed && !j.whileFullTimeStudent;
}

function countsAbroad(j: Job) {
  return j.country === "foreign" && isSkilled(j) && j.paid !== false;
}

export function workYears(jobs: Job[], on: Date) {
  const canadian = Math.floor(creditedHours(jobs.filter(countsInCanada), on) / HOURS_PER_YEAR);
  const foreign = Math.floor(creditedHours(jobs.filter(countsAbroad), on) / HOURS_PER_YEAR);
  return { canadian, foreign };
}

const WAGE_ORDER: HighWageLevel[] = ["x2", "x1_5", "x1_3"];
const wageRank = (l?: string) => (l === "x2" ? 3 : l === "x1_5" ? 2 : l === "x1_3" ? 1 : 0);

/** Highest level with at least 12 months of combined Canadian work at that level or above. */
export function highWageExperience(jobs: Job[], on: Date): HighWageLevel {
  const counted = jobs.filter(countsInCanada);
  for (const level of WAGE_ORDER) {
    const atOrAbove = counted.filter((j) => wageRank(j.highWage) >= wageRank(level));
    if (creditedHours(atOrAbove, on) >= HOURS_PER_YEAR) return level;
  }
  return "none";
}

function testToClb(test: LanguageTest | null | undefined, who: string, missing: Missing[], notes: string[], on: Date): ClbLevels | null {
  if (!test) return null;
  try {
    const levels = scoresToClb(test.type, test);
    if (test.date && !testIsValid(test.date, on)) {
      notes.push(`${who} ${TESTS[test.type].label} result is more than 2 years old. IRCC does not accept expired results, so you would need a new test.`);
    }
    if (!test.date) missing.push({ step: "language", message: `Add the date of ${who.toLowerCase()} ${TESTS[test.type].label} test.` });
    return levels;
  } catch (e) {
    missing.push({ step: "language", message: `${who} ${TESTS[test.type].label} scores: ${(e as Error).message}.` });
    return null;
  }
}

function educationForCrs(p: Profile, missing: Missing[], notes: string[]): EducationLevel | null {
  if (!p.educationLevel) {
    missing.push({ step: "education", message: "Tell us your highest level of education." });
    return null;
  }
  if (p.educationEarnedIn === "foreign") {
    if (p.ecaStatus === "completed" && p.ecaEquivalent) return p.ecaEquivalent;
    missing.push({
      step: "education",
      message: "Education from outside Canada only earns points with an Educational Credential Assessment (ECA). Add your ECA result, or start one.",
    });
    return "less_than_secondary";
  }
  if (p.educationEarnedIn === "both") {
    notes.push("You have Canadian and foreign credentials. We used the level you entered; if it is the foreign one, it needs an ECA to count.");
  }
  if (!p.educationEarnedIn) missing.push({ step: "education", message: "Tell us whether your highest credential is from Canada or another country." });
  return p.educationLevel;
}

function canadianEducation(p: Profile, notes: string[]): CanadianEducation {
  if (!p.canadianCredentialType || !p.canadianProgramLengthMonths) return "none";
  if (p.canadianStudyFullTime !== "yes" || p.canadianStudyInPerson !== "yes") {
    notes.push("Canadian study only earns additional points if it was full-time, in person, in Canada for at least 8 months. Confirm both answers on the education step for it to count.");
    return "none";
  }
  const long =
    p.canadianCredentialType === "masters" || p.canadianCredentialType === "doctoral" || p.canadianProgramLengthMonths >= 36;
  return long ? "three_year_or_more" : p.canadianProgramLengthMonths >= 8 ? "one_or_two_year" : "none";
}

export function deriveCrs(p: Profile, on: Date): DerivedCrs {
  const missing: Missing[] = [];
  const notes: string[] = [];

  if (!p.dateOfBirth) missing.push({ step: "about", message: "Add your date of birth." });
  const education = educationForCrs(p, missing, notes);
  const english = testToClb(p.englishTest, "Your", missing, notes, on);
  const french = testToClb(p.frenchTest, "Your", missing, notes, on);
  if (!english && !french) missing.push({ step: "language", message: "Add an English or French test result. Express Entry requires one." });

  const jobs = p.jobs ?? [];
  const unknownTeer = jobs.filter((j) => !j.teer || j.teer === "unknown");
  if (unknownTeer.length) {
    missing.push({
      step: "work",
      message: `${unknownTeer.length} job${unknownTeer.length > 1 ? "s have" : " has"} no TEER category, so ${unknownTeer.length > 1 ? "they were" : "it was"} not counted. Find the NOC code that matches the duties, not just the title.`,
    });
  }
  if (jobs.some((j) => j.country === "canada" && (j.selfEmployed || j.whileFullTimeStudent))) {
    notes.push("Canadian self-employment and work done while you were a full-time student were not counted as Canadian work experience.");
  }
  const years = workYears(jobs, on);

  const partnered = p.maritalStatus === "married" || p.maritalStatus === "common_law";
  let accompanying = false;
  if (partnered) {
    if (p.spouseIsCitizenOrPr === "yes") {
      notes.push("Your spouse or partner is a Canadian citizen or PR, so you are scored as a single applicant.");
    } else if (p.spouseAccompanying === "yes" && p.spouseIsCitizenOrPr === "no") {
      accompanying = true;
    } else if (p.spouseAccompanying !== "no") {
      missing.push({ step: "about", message: "Tell us whether your spouse or partner will come to Canada with you and whether they are a citizen or PR." });
    }
  }
  if (accompanying && !p.spouseEducation) missing.push({ step: "about", message: "Add your spouse or partner's education." });
  const spouseLanguage = accompanying ? testToClb(p.spouseTest, "Your spouse's", missing, notes, on) : null;

  if (!p.dateOfBirth || !education) {
    return { input: null, missing, notes, canadianWorkYears: years.canadian, foreignWorkYears: years.foreign };
  }

  const input: CrsInput = {
    age: ageOn(p.dateOfBirth, on),
    accompanyingSpouse: accompanying,
    education,
    english,
    french,
    firstLanguage: "auto",
    canadianWorkYears: years.canadian,
    foreignWorkYears: years.foreign,
    highWageExperience: highWageExperience(jobs, on),
    jobOffer: p.jobOfferHighWage ?? "none",
    certificateOfQualification: p.certificateOfQualification === "yes",
    canadianEducation: canadianEducation(p, notes),
    siblingInCanada: p.siblingInCanada === "yes",
    provincialNomination: p.provincialNomination === "yes",
    spouse: accompanying
      ? { education: p.spouseEducation ?? "less_than_secondary", language: spouseLanguage, canadianWorkYears: p.spouseCanadianWorkYears ?? 0 }
      : null,
  };
  return { input, missing, notes, canadianWorkYears: years.canadian, foreignWorkYears: years.foreign };
}

export interface DerivedDeadline {
  kind: string;
  title: string;
  dueDate: string;
  detail: string;
  sourceUrl: string;
  urgent: boolean;
}

const addYears = (iso: string, n: number) => {
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCFullYear(d.getUTCFullYear() + n);
  return d.toISOString().slice(0, 10);
};
const addDays = (iso: string, n: number) => new Date(new Date(iso + "T00:00:00Z").getTime() + n * DAY).toISOString().slice(0, 10);

export function daysUntil(iso: string, on: Date) {
  return Math.ceil((new Date(iso + "T00:00:00Z").getTime() - on.getTime()) / DAY);
}

export function deriveDeadlines(p: Profile, on: Date): DerivedDeadline[] {
  const out: DerivedDeadline[] = [];
  if (p.permitExpiryDate && p.status && !["maintained", "out_of_status", "outside_canada"].includes(p.status)) {
    const days = daysUntil(p.permitExpiryDate, on);
    out.push({
      kind: "permit_expiry",
      title: p.status === "pgwp" ? "PGWP expires" : p.status === "student" ? "Study permit expires" : "Permit expires",
      dueDate: p.permitExpiryDate,
      detail:
        "If you apply to extend or change your status before this date, you can usually stay and keep your conditions while IRCC decides (maintained status). Applying after it passes is a different, riskier process.",
      sourceUrl: "https://www.canada.ca/en/immigration-refugees-citizenship/services/work-canada.html",
      urgent: days <= 90,
    });
  }
  if (p.status === "out_of_status" && p.statusExpiredDate) {
    out.push({
      kind: "restoration_window",
      title: "Last day to apply to restore your status",
      dueDate: addDays(p.statusExpiredDate, 90),
      detail:
        "IRCC must receive a restoration application no more than 90 days after your status expired. Speak to a licensed immigration consultant (RCIC) or lawyer now.",
      sourceUrl: "https://www.canada.ca/en/immigration-refugees-citizenship/services/work-canada/restore.html",
      urgent: true,
    });
  }
  for (const [test, who] of [[p.englishTest, "English"], [p.frenchTest, "French"]] as const) {
    if (test?.date) {
      const due = addYears(test.date, 2);
      out.push({
        kind: "language_expiry",
        title: `${who} test result expires`,
        dueDate: due,
        detail: "Results must be less than 2 years old when you create your Express Entry profile and when you submit your PR application.",
        sourceUrl: "https://www.canada.ca/en/immigration-refugees-citizenship/services/immigrate-canada/express-entry/documents/language-test.html",
        urgent: daysUntil(due, on) <= 120,
      });
    }
  }
  if (p.ecaStatus === "completed" && p.ecaDate) {
    const due = addYears(p.ecaDate, 5);
    out.push({
      kind: "eca_expiry",
      title: "Educational Credential Assessment expires",
      dueDate: due,
      detail: "An ECA must be less than 5 years old when you complete your Express Entry profile and when you submit your PR application.",
      sourceUrl: "https://www.canada.ca/en/immigration-refugees-citizenship/services/immigrate-canada/express-entry/documents/education-assessed.html",
      urgent: daysUntil(due, on) <= 120,
    });
  }
  return out.sort((a, b) => a.dueDate.localeCompare(b.dueDate));
}

/** Situations where the platform must send the person to a licensed professional. */
export function professionalFlags(p: Profile): string[] {
  const flags: string[] = [];
  if (p.status === "out_of_status") flags.push("You may be out of status. Time limits apply to restoration.");
  if (p.status === "refugee_claimant") flags.push("Refugee claims have their own legal process and deadlines.");
  if (p.previousViolations === "yes") flags.push("A past immigration violation can affect admissibility.");
  if (p.previousRefusals === "yes") flags.push("A past refusal should be reviewed before you apply again, so the same concerns are answered.");
  return flags;
}
