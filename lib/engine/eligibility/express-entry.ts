/**
 * Express Entry program eligibility, separate from CRS. Each requirement is
 * "meets", "not_met" or "needs_info"; nothing unknown is ever counted as met.
 * Results are based on what the person told us and are not a decision.
 */
import { minClb, scoresToClb, testIsValid, type ClbLevels } from "../language";
import { ageOn, creditedHours, isSkilled } from "../../profile/derive";
import type { Job, LanguageTest, Profile } from "../../profile/schema";
import { CATEGORIES, FSW, fundsRequired, FUNDS, isFstTrade, LANGUAGE_MIN, SOURCES, VERIFIED_AT } from "./rules";

export type Verdict = "meets" | "not_met" | "needs_info";

export interface Requirement {
  key: string;
  label: string;
  verdict: Verdict;
  detail: string;
}

export interface PointsLine {
  label: string;
  points: number;
  max: number;
}

export interface ProgramResult {
  id: string;
  name: string;
  verdict: Verdict;
  requirements: Requirement[];
  points?: { total: number; pass: number; lines: PointsLine[] };
  sourceUrl: string;
  verifiedAt: string;
  notes: string[];
}

export interface CategoryResult {
  key: string;
  name: string;
  verdict: Verdict;
  detail: string;
}

const YEAR_HOURS = 1560;

export function overall(reqs: Requirement[]): Verdict {
  if (reqs.some((r) => r.verdict === "not_met")) return "not_met";
  if (reqs.some((r) => r.verdict === "needs_info")) return "needs_info";
  return "meets";
}

interface Lang {
  first: ClbLevels | null;
  second: ClbLevels | null;
  firstName: string;
  expired: boolean;
  invalid: boolean;
}

function levels(t: LanguageTest | null | undefined, on: Date): { clb: ClbLevels | null; expired: boolean; invalid: boolean } {
  if (!t) return { clb: null, expired: false, invalid: false };
  try {
    return { clb: scoresToClb(t.type, t), expired: Boolean(t.date) && !testIsValid(t.date!, on), invalid: false };
  } catch {
    return { clb: null, expired: false, invalid: true };
  }
}

export function languageOf(p: Profile, on: Date): Lang {
  const en = levels(p.englishTest, on);
  const fr = levels(p.frenchTest, on);
  const score = (c: ClbLevels | null) => (c ? minClb(c) * 100 + c.listening + c.reading + c.writing + c.speaking : -1);
  const frFirst = score(fr.clb) > score(en.clb);
  return {
    first: frFirst ? fr.clb : en.clb,
    second: frFirst ? en.clb : fr.clb,
    firstName: frFirst ? "French (NCLC)" : "English (CLB)",
    expired: frFirst ? fr.expired : en.expired,
    invalid: en.invalid || fr.invalid,
  };
}

const jobsOf = (p: Profile) => p.jobs ?? [];
const paid = (j: Job) => j.paid !== false;
const inCanadaCounts = (j: Job) => j.country === "canada" && isSkilled(j) && paid(j) && !j.selfEmployed && !j.whileFullTimeStudent;
const unknownTeer = (j: Job) => !j.teer || j.teer === "unknown";
const fmtYears = (h: number) => `${(h / YEAR_HOURS).toFixed(1)} years (${Math.round(h)} hours)`;

function languageReq(lang: Lang, label: string, test: (c: ClbLevels) => boolean, need: string): Requirement {
  if (lang.invalid) return { key: "language", label, verdict: "needs_info", detail: "One of your test scores is outside the possible range. Check your language step." };
  if (!lang.first) return { key: "language", label, verdict: "needs_info", detail: `Add an approved English or French test. You need ${need}.` };
  if (lang.expired) return { key: "language", label, verdict: "not_met", detail: "Your test result is more than 2 years old. IRCC only accepts results under 2 years old." };
  return test(lang.first)
    ? { key: "language", label, verdict: "meets", detail: `Your ${lang.firstName} results meet ${need}.` }
    : { key: "language", label, verdict: "not_met", detail: `You need ${need}. Your lowest ability is level ${minClb(lang.first)}.` };
}

function quebecReq(p: Profile): Requirement {
  const prefs = p.preferredProvinces ?? [];
  const onlyQuebec = (prefs.length > 0 && prefs.every((x) => x === "Quebec")) || (p.province === "Quebec" && p.willingToRelocate === "no");
  if (onlyQuebec)
    return { key: "quebec", label: "Plan to live outside Quebec", verdict: "not_met", detail: "Express Entry is for people settling outside Quebec. Quebec selects its own immigrants." };
  if (p.province === "Quebec" && !prefs.some((x) => x !== "Quebec"))
    return { key: "quebec", label: "Plan to live outside Quebec", verdict: "needs_info", detail: "You live in Quebec. Express Entry requires that you plan to live in another province or territory." };
  return { key: "quebec", label: "Plan to live outside Quebec", verdict: "meets", detail: "You haven't said you plan to settle in Quebec." };
}

function familySize(p: Profile) {
  return 1 + (p.maritalStatus === "married" || p.maritalStatus === "common_law" ? 1 : 0) + (p.children ?? 0);
}

const AUTHORIZED = new Set(["pgwp", "closed_work_permit", "open_work_permit"]);

function fundsReq(p: Profile): Requirement {
  const label = "Settlement funds";
  if (AUTHORIZED.has(p.status ?? "") && p.jobOfferValid === "yes") {
    return { key: "funds", label, verdict: "meets", detail: "You're authorized to work in Canada and have a valid job offer, so you don't need to show funds. You'll upload a letter explaining this." };
  }
  const size = familySize(p);
  const need = fundsRequired(size);
  const note = ` The table was last updated ${FUNDS.updated}; IRCC updates it every year, so check the current amount.`;
  if (p.settlementFunds === undefined) {
    return { key: "funds", label, verdict: "needs_info", detail: `For a family of ${size}, IRCC's table asks for $${need.toLocaleString("en-CA")}. Tell us how much you could show.${note}` };
  }
  return p.settlementFunds >= need
    ? { key: "funds", label, verdict: "meets", detail: `You said you have $${p.settlementFunds.toLocaleString("en-CA")}; a family of ${size} needs $${need.toLocaleString("en-CA")}.${note}` }
    : { key: "funds", label, verdict: "not_met", detail: `A family of ${size} needs $${need.toLocaleString("en-CA")}; you said $${p.settlementFunds.toLocaleString("en-CA")}. Borrowed money and home equity don't count.${note}` };
}

/** Hours per NOC code, for "same occupation" rules. Jobs without a code are returned separately. */
function hoursByNoc(jobs: Job[], on: Date, years: number) {
  const byCode = new Map<string, number>();
  for (const code of new Set(jobs.map((j) => j.nocCode).filter((c): c is string => Boolean(c)))) {
    byCode.set(code, creditedHours(jobs.filter((j) => j.nocCode === code), on, years));
  }
  return { byCode, uncoded: jobs.filter((j) => !j.nocCode) };
}

export function assessCec(p: Profile, on: Date): ProgramResult {
  const jobs = jobsOf(p);
  const lang = languageOf(p, on);
  const counted = jobs.filter(inCanadaCounts);
  const total = creditedHours(counted, on, 3);
  const teer01 = creditedHours(counted.filter((j) => j.teer === "0" || j.teer === "1"), on, 3);
  const teer23 = creditedHours(counted.filter((j) => j.teer === "2" || j.teer === "3"), on, 3);
  const pendingTeer = jobs.some((j) => j.country === "canada" && unknownTeer(j));

  const work: Requirement =
    total >= YEAR_HOURS
      ? { key: "work", label: "1 year of skilled Canadian work in the last 3 years", verdict: "meets", detail: `You have about ${fmtYears(total)} of paid TEER 0 to 3 work in Canada in the last 3 years.` }
      : pendingTeer
        ? { key: "work", label: "1 year of skilled Canadian work in the last 3 years", verdict: "needs_info", detail: `We count ${fmtYears(total)} so far. Add the TEER category for your other Canadian jobs.` }
        : { key: "work", label: "1 year of skilled Canadian work in the last 3 years", verdict: "not_met", detail: `You need 1,560 hours; we count ${Math.round(total)}. Self-employment, unpaid work and work while a full-time student don't count.` };

  let language: Requirement;
  const label = "Language (CLB 7 for TEER 0 or 1 work, CLB 5 for TEER 2 or 3)";
  if (!lang.first || lang.expired || lang.invalid) language = languageReq(lang, label, () => false, "CLB 7 (TEER 0 or 1) or CLB 5 (TEER 2 or 3)");
  else {
    const m = minClb(lang.first);
    if (m >= LANGUAGE_MIN.cecTeer01) language = { key: "language", label, verdict: "meets", detail: `Your lowest ability is level ${m}, enough for any skilled experience.` };
    else if (m >= LANGUAGE_MIN.cecTeer23 && teer23 >= YEAR_HOURS) language = { key: "language", label, verdict: "meets", detail: `Level ${m} meets the CLB 5 minimum for your TEER 2 or 3 experience.` };
    else if (m >= LANGUAGE_MIN.cecTeer23 && teer01 > 0)
      language = { key: "language", label, verdict: "not_met", detail: `Level ${m} is enough for TEER 2 or 3 work, but your TEER 2 or 3 experience is under a year and TEER 0 or 1 experience needs CLB 7.` };
    else language = { key: "language", label, verdict: total < YEAR_HOURS && m >= LANGUAGE_MIN.cecTeer23 ? "needs_info" : "not_met", detail: `Your lowest ability is level ${m}. You need at least CLB 5, or CLB 7 for TEER 0 or 1 work.` };
  }

  const reqs = [work, language, quebecReq(p)];
  return {
    id: "cec",
    name: "Canadian Experience Class",
    verdict: overall(reqs),
    requirements: reqs,
    sourceUrl: SOURCES.cec,
    verifiedAt: VERIFIED_AT,
    notes: ["No education requirement, but education still earns CRS points.", "Your experience must match the lead statement and most main duties of its NOC.", "Admissibility (health, security, criminality) is not assessed here."],
  };
}

function educationLevelForFsw(p: Profile): { level: string | null; ok: Verdict; detail: string } {
  if (!p.educationLevel) return { level: null, ok: "needs_info", detail: "Add your highest education." };
  if (p.educationEarnedIn === "foreign") {
    if (p.ecaStatus === "completed" && p.ecaEquivalent) return { level: p.ecaEquivalent, ok: "meets", detail: "Foreign credential with an ECA." };
    return { level: null, ok: "not_met", detail: "Foreign education needs an Educational Credential Assessment (ECA) for FSW." };
  }
  if (!p.educationEarnedIn) return { level: p.educationLevel, ok: "needs_info", detail: "Tell us whether your credential is Canadian or foreign." };
  if (p.educationLevel === "less_than_secondary") return { level: p.educationLevel, ok: "not_met", detail: "FSW needs at least a completed secondary school credential." };
  return { level: p.educationLevel, ok: "meets", detail: "Canadian credential." };
}

export function assessFsw(p: Profile, on: Date): ProgramResult {
  const jobs = jobsOf(p).filter((j) => isSkilled(j) && paid(j));
  const lang = languageOf(p, on);
  const notes = [
    "Experience must be continuous (no gaps) in one occupation. We can't check gaps from dates alone; confirm yours.",
    "Admissibility is not assessed here.",
  ];

  // Minimum: 1 year continuous in one NOC within 10 years.
  const { byCode, uncoded } = hoursByNoc(jobs, on, 10);
  const best = [...byCode.entries()].sort((a, b) => b[1] - a[1])[0];
  let work: Requirement;
  const wLabel = "1 year of skilled work in one occupation in the last 10 years";
  if (best && best[1] >= YEAR_HOURS) work = { key: "work", label: wLabel, verdict: "meets", detail: `About ${fmtYears(best[1])} as NOC ${best[0]}.` };
  else if (uncoded.length || jobsOf(p).some(unknownTeer)) work = { key: "work", label: wLabel, verdict: "needs_info", detail: "Add the NOC code and TEER for each job so we can check you have a year in one occupation." };
  else work = { key: "work", label: wLabel, verdict: "not_met", detail: best ? `Your longest skilled occupation is ${fmtYears(best[1])} (NOC ${best[0]}).` : "No paid TEER 0 to 3 work entered." };

  const language = languageReq(lang, "Language: CLB 7 in all four abilities", (c) => minClb(c) >= LANGUAGE_MIN.fswFirst, "CLB 7 in all four abilities");
  const edu = educationLevelForFsw(p);
  const education: Requirement = { key: "education", label: "Education (Canadian credential, or foreign with an ECA)", verdict: edu.ok, detail: edu.detail };

  // Selection grid
  const lines: PointsLine[] = [];
  const firstPts = lang.first
    ? (["speaking", "listening", "reading", "writing"] as const).reduce((s, a) => s + (FSW.firstLanguagePerAbility.find((r) => lang.first![a] >= r.minClb)?.points ?? 0), 0)
    : 0;
  lines.push({ label: "First official language", points: firstPts, max: 24 });
  const secondPts = lang.second && minClb(lang.second) >= FSW.secondLanguageAllFour.minClb ? FSW.secondLanguageAllFour.points : 0;
  lines.push({ label: "Second official language", points: secondPts, max: 4 });
  lines.push({ label: "Education", points: edu.level ? FSW.education[edu.level] ?? 0 : 0, max: 25 });
  const expYears = Math.floor(creditedHours(jobs, on, 10) / YEAR_HOURS);
  lines.push({ label: `Skilled work experience (${expYears} year${expYears === 1 ? "" : "s"})`, points: FSW.experience(expYears), max: 15 });
  const age = p.dateOfBirth ? ageOn(p.dateOfBirth, on) : null;
  lines.push({ label: age === null ? "Age (not entered)" : `Age ${age}`, points: age === null ? 0 : FSW.age(age), max: 12 });
  const offer = p.jobOfferValid === "yes" && ["0", "1", "2", "3"].includes(p.jobOfferTeer ?? "");
  lines.push({ label: "Arranged employment", points: offer ? FSW.arrangedEmployment : 0, max: 10 });

  const a = FSW.adaptability;
  const partnered = (p.maritalStatus === "married" || p.maritalStatus === "common_law") && p.spouseAccompanying === "yes";
  const spouseLang = partnered ? levels(p.spouseTest, on).clb : null;
  let adapt = 0;
  if (spouseLang && minClb(spouseLang) >= 4) adapt += a.spouseLanguage;
  if (p.canadianStudyFullTime === "yes" && (p.canadianProgramLengthMonths ?? 0) >= 16) adapt += a.ownStudy;
  if (creditedHours(jobsOf(p).filter((j) => j.country === "canada" && isSkilled(j) && paid(j)), on, 10) >= YEAR_HOURS) adapt += a.ownWork;
  if (partnered && (p.spouseCanadianWorkYears ?? 0) >= 1) adapt += a.spouseWork;
  if (offer) adapt += a.arrangedEmployment;
  if (p.siblingInCanada === "yes" || p.relativeInCanada === "yes") adapt += a.relative;
  lines.push({ label: "Adaptability", points: Math.min(a.cap, adapt), max: a.cap });
  const total = lines.reduce((s, l) => s + l.points, 0);

  const points: Requirement =
    total >= FSW.passMark
      ? { key: "points", label: "67 points on the selection grid", verdict: "meets", detail: `You score ${total} of 100.` }
      : { key: "points", label: "67 points on the selection grid", verdict: !lang.first || !p.dateOfBirth || edu.ok === "needs_info" ? "needs_info" : "not_met", detail: `You score ${total} of 100 with what you've told us; the pass mark is 67.` };

  const reqs = [work, language, education, points, fundsReq(p), quebecReq(p)];
  if (p.canadianStudyFullTime === "yes" && (p.canadianProgramLengthMonths ?? 0) >= 16) {
    notes.push("Adaptability counts your Canadian study if it was at least two full academic years; we treated 16 months or more as two academic years.");
  }
  return { id: "fsw", name: "Federal Skilled Worker Program", verdict: overall(reqs), requirements: reqs, points: { total, pass: FSW.passMark, lines }, sourceUrl: SOURCES.fsw, verifiedAt: VERIFIED_AT, notes };
}

export function assessFst(p: Profile, on: Date): ProgramResult {
  const jobs = jobsOf(p).filter((j) => paid(j) && !j.whileFullTimeStudent);
  const lang = languageOf(p, on);
  const trades = jobs.filter((j) => j.nocCode && isFstTrade(j.nocCode));
  const { byCode } = hoursByNoc(trades, on, 5);
  const best = [...byCode.entries()].sort((a, b) => b[1] - a[1])[0];
  const wLabel = "2 years in an eligible skilled trade in the last 5 years";
  let work: Requirement;
  if (best && best[1] >= 2 * YEAR_HOURS) work = { key: "work", label: wLabel, verdict: "meets", detail: `About ${fmtYears(best[1])} as NOC ${best[0]}.` };
  else if (jobs.some((j) => !j.nocCode)) work = { key: "work", label: wLabel, verdict: "needs_info", detail: "Add NOC codes to your jobs so we can check whether they are eligible trades." };
  else work = { key: "work", label: wLabel, verdict: "not_met", detail: best ? `Your trade experience is ${fmtYears(best[1])}; you need 3,120 hours.` : "None of your jobs is in an eligible trade group (such as NOC major groups 72, 73, 82, 83, 92 or 93)." };

  const language = languageReq(
    lang,
    "Language: CLB 5 speaking and listening, CLB 4 reading and writing",
    (c) => c.speaking >= LANGUAGE_MIN.fstSpeakListen && c.listening >= LANGUAGE_MIN.fstSpeakListen && c.reading >= LANGUAGE_MIN.fstReadWrite && c.writing >= LANGUAGE_MIN.fstReadWrite,
    "CLB 5 in speaking and listening and CLB 4 in reading and writing",
  );
  const offerOrCert: Requirement =
    p.jobOfferValid === "yes" || p.certificateOfQualification === "yes"
      ? { key: "offer_or_certificate", label: "A full-time job offer of at least 1 year, or a certificate of qualification", verdict: "meets", detail: p.certificateOfQualification === "yes" ? "You have a certificate of qualification." : "You have a valid job offer." }
      : p.jobOfferValid === undefined && p.certificateOfQualification === undefined
        ? { key: "offer_or_certificate", label: "A full-time job offer of at least 1 year, or a certificate of qualification", verdict: "needs_info", detail: "Tell us about any job offer or trade certificate." }
        : { key: "offer_or_certificate", label: "A full-time job offer of at least 1 year, or a certificate of qualification", verdict: "not_met", detail: "You need one or the other." };

  const reqs = [work, language, offerOrCert, fundsReq(p), quebecReq(p)];
  return {
    id: "fst",
    name: "Federal Skilled Trades Program",
    verdict: overall(reqs),
    requirements: reqs,
    sourceUrl: SOURCES.fst,
    verifiedAt: VERIFIED_AT,
    notes: ["You must have been qualified to practise the trade where you worked, and meet the NOC job requirements.", "No education requirement."],
  };
}

export function assessCategories(p: Profile, on: Date): CategoryResult[] {
  const lang = languageOf(p, on);
  const fr = levels(p.frenchTest, on).clb;
  const jobs = jobsOf(p).filter((j) => isSkilled(j) || j.nocCode);
  return CATEGORIES.map((c) => {
    if (c.kind === "military") return { key: c.key, name: c.name, verdict: "not_met" as Verdict, detail: "For serving members of recognized foreign militaries with a Canadian Armed Forces job offer. Not assessed here." };
    if (c.kind === "language") {
      if (!fr) return { key: c.key, name: c.name, verdict: (p.learnFrench === "yes" ? "needs_info" : "not_met") as Verdict, detail: "Needs NCLC 7 in all four French abilities." };
      const ok = minClb(fr) >= 7 && !levels(p.frenchTest, on).expired;
      return { key: c.key, name: c.name, verdict: (ok ? "meets" : "not_met") as Verdict, detail: ok ? "Your French test shows NCLC 7 or higher in all four abilities." : `Needs NCLC 7 in all four abilities; your lowest is ${minClb(fr)}.` };
    }
    const pool = jobs.filter((j) => paid(j) && (!c.canadaOnly || j.country === "canada"));
    const matching = pool.filter((j) => j.nocCode && c.nocs!.includes(j.nocCode));
    const { byCode } = hoursByNoc(matching, on, 3);
    const best = [...byCode.entries()].sort((x, y) => y[1] - x[1])[0];
    if (best && best[1] >= YEAR_HOURS) return { key: c.key, name: c.name, verdict: "meets" as Verdict, detail: `About ${fmtYears(best[1])} as NOC ${best[0]} in the last 3 years${c.canadaOnly ? ", in Canada" : ""}.` };
    if (best) return { key: c.key, name: c.name, verdict: "not_met" as Verdict, detail: `NOC ${best[0]} is listed, but you have ${fmtYears(best[1])} in the last 3 years; you need 12 months.` };
    if (pool.some((j) => !j.nocCode)) return { key: c.key, name: c.name, verdict: "needs_info" as Verdict, detail: "Add NOC codes to your jobs to check this category." };
    return { key: c.key, name: c.name, verdict: "not_met" as Verdict, detail: "None of your occupations is on this category's list." };
  }).map((r) => (lang.first || r.key !== "french" ? r : r));
}

export function assessExpressEntry(p: Profile, on: Date) {
  const programs = [assessCec(p, on), assessFsw(p, on), assessFst(p, on)];
  return { programs, categories: assessCategories(p, on), anyProgram: programs.some((x) => x.verdict === "meets") };
}
