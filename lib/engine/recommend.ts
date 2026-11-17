/**
 * Personalized pathway recommendations. Deterministic: the same profile and
 * date always give the same ranking and the same reasons. A pathway is only
 * called "potential" when the person meets every requirement we can check;
 * anything we can't check is listed, never assumed.
 */
import { PROGRAMS, type ProgramRecord, type ProgramStatus } from "../data/programs";
import { calculateCrs } from "./crs/calculate";
import { ruleSetFor } from "./crs/rules";
import { assessExpressEntry, languageOf, overall, type CategoryResult, type ProgramResult, type Requirement, type Verdict } from "./eligibility/express-entry";
import { minClb, scoresToClb } from "./language";
import { creditedHours, deriveCrs, isSkilled, professionalFlags } from "../profile/derive";
import type { Job, Profile } from "../profile/schema";

export type Bucket = "potential" | "needs_info" | "not_now";

export interface Recommendation {
  id: string;
  name: string;
  jurisdiction: string;
  kind: ProgramRecord["kind"] | "express_entry";
  status: ProgramStatus;
  statusNote: string;
  bucket: Bucket;
  score: number;
  reasons: string[];
  gaps: string[];
  requirements: Requirement[] | null;
  checkedOnly: string[];
  documents: string[];
  url: string;
  verifiedAt: string;
  extra?: { crs?: number; fswPoints?: number; categories?: CategoryResult[] };
}

export interface Milestone {
  title: string;
  detail: string;
  due: string | null;
  href?: string;
  priority: "now" | "soon" | "later";
}

export interface RecommendationReport {
  generatedAt: string;
  potential: Recommendation[];
  needsInfo: Recommendation[];
  notNow: Recommendation[];
  plan: Milestone[];
  flags: string[];
}

const ATLANTIC = ["New Brunswick", "Newfoundland and Labrador", "Nova Scotia", "Prince Edward Island"];
const AUTHORIZED = new Set(["pgwp", "closed_work_permit", "open_work_permit"]);
const YEAR_HOURS = 1560;
const DAY = 86400_000;

const EE_DOCS = [
  "Passport or travel document",
  "Language test results (less than 2 years old)",
  "Educational Credential Assessment for foreign education, or your Canadian credential",
  "Reference letters for each job: title, duties, hours, salary and dates, on company letterhead",
  "Proof of funds, unless you're exempt",
  "Police certificates and a medical exam (requested after an invitation)",
];

const COMMUNITY_DOCS = [
  "Passport or travel document",
  "Job offer and the employer's designation confirmation",
  "Community recommendation or provincial endorsement",
  "Language test results (less than 2 years old)",
  "Education documents or ECA",
  "Reference letters for your work experience",
  "Proof of funds, unless you're working in Canada on a valid permit",
];

const STATUS_POINTS: Record<ProgramStatus, number> = { open: 20, invitation: 12, closing: 5, opens_later: 3, paused: -20, not_stated: 0, not_verified: -10, closed: -100 };

function placesFor(p: Profile) {
  const current = p.province ?? null;
  const preferred = new Set(p.preferredProvinces ?? []);
  const anywhere = p.willingToRelocate === "yes";
  return {
    current,
    preferred,
    anywhere,
    fit(prov: string): { points: number; reason: string | null; blocked: string | null } {
      if (current === prov) return { points: 15, reason: `You live in ${prov}.`, blocked: null };
      if (preferred.has(prov)) return { points: 8, reason: `${prov} is on your list of provinces.`, blocked: null };
      if (anywhere) return { points: 0, reason: null, blocked: null };
      if (p.willingToRelocate === "no") return { points: -40, reason: null, blocked: `You said you wouldn't move to ${prov}.` };
      return { points: -5, reason: null, blocked: null };
    },
  };
}

function bucketOf(v: Verdict): Bucket {
  return v === "meets" ? "potential" : v === "needs_info" ? "needs_info" : "not_now";
}

function educationOk(p: Profile, minLevel: "secondary" | "one_year"): Verdict {
  const order = ["less_than_secondary", "secondary", "one_year", "two_year", "bachelors_or_three_year", "two_or_more", "masters_or_professional", "doctoral"];
  const level = p.educationEarnedIn === "foreign" ? (p.ecaStatus === "completed" ? p.ecaEquivalent : undefined) : p.educationLevel;
  if (!level) return "needs_info";
  return order.indexOf(level) >= order.indexOf(minLevel) ? "meets" : "not_met";
}

function jobOfferReq(p: Profile, where: string): Requirement {
  if (p.jobOfferValid === "yes") return { key: "offer", label: `A job offer from a designated employer ${where}`, verdict: "needs_info", detail: "You have a job offer. Confirm the employer is designated for this program; only they can tell you." };
  if (p.jobOfferValid === "no") return { key: "offer", label: `A job offer from a designated employer ${where}`, verdict: "not_met", detail: "You need a job offer from a designated employer first." };
  return { key: "offer", label: `A job offer from a designated employer ${where}`, verdict: "needs_info", detail: "Tell us whether you have a job offer." };
}

function fundsReq(p: Profile, table: number[], extra: number, updated: string): Requirement {
  if (AUTHORIZED.has(p.status ?? "")) return { key: "funds", label: "Settlement funds", verdict: "meets", detail: "Not needed while you work in Canada on a valid permit." };
  const size = 1 + (p.maritalStatus === "married" || p.maritalStatus === "common_law" ? 1 : 0) + (p.children ?? 0);
  const need = size <= 7 ? table[size - 1] : table[6] + (size - 7) * extra;
  if (p.settlementFunds === undefined) return { key: "funds", label: "Settlement funds", verdict: "needs_info", detail: `A family of ${size} needs $${need.toLocaleString("en-CA")} (table updated ${updated}).` };
  return p.settlementFunds >= need
    ? { key: "funds", label: "Settlement funds", verdict: "meets", detail: `You have enough for a family of ${size} ($${need.toLocaleString("en-CA")}).` }
    : { key: "funds", label: "Settlement funds", verdict: "not_met", detail: `A family of ${size} needs $${need.toLocaleString("en-CA")}.` };
}

function workReq(p: Profile, on: Date, years: number): Requirement {
  const jobs = (p.jobs ?? []).filter((j: Job) => j.paid !== false && !j.selfEmployed && j.teer && j.teer !== "unknown");
  const h = creditedHours(jobs, on, years);
  if (h >= YEAR_HOURS) return { key: "work", label: `1 year (1,560 hours) of related paid work in the past ${years} years`, verdict: "meets", detail: `About ${Math.round(h)} hours. It must relate to the job offered; the TEER matching rules are on the official page.` };
  if ((p.jobs ?? []).some((j) => !j.teer || j.teer === "unknown")) return { key: "work", label: `1 year of related paid work in the past ${years} years`, verdict: "needs_info", detail: "Add TEER categories to your jobs." };
  return { key: "work", label: `1 year of related paid work in the past ${years} years`, verdict: "not_met", detail: `We count ${Math.round(h)} hours. Some local graduates are exempt; check the official page.` };
}

function langByTeer(p: Profile, on: Date, byTeer: (teer: number) => number, label: string): Requirement {
  const lang = languageOf(p, on);
  if (!lang.first) return { key: "language", label, verdict: "needs_info", detail: "Add an approved language test." };
  if (lang.expired) return { key: "language", label, verdict: "not_met", detail: "Your test result is more than 2 years old." };
  const teer = p.jobOfferTeer && p.jobOfferTeer !== "unknown" ? Number(p.jobOfferTeer) : null;
  if (teer === null) return { key: "language", label, verdict: "needs_info", detail: `Your lowest ability is level ${minClb(lang.first)}. The minimum depends on the TEER of the job offered.` };
  const need = byTeer(teer);
  return minClb(lang.first) >= need
    ? { key: "language", label, verdict: "meets", detail: `Level ${minClb(lang.first)} meets the CLB ${need} minimum for a TEER ${teer} job.` }
    : { key: "language", label, verdict: "not_met", detail: `A TEER ${teer} job needs CLB ${need}; your lowest ability is ${minClb(lang.first)}.` };
}

function communityReqs(id: string, p: Profile, on: Date): Requirement[] | null {
  const rcipFunds = [10507, 13080, 16080, 19524, 22143, 24975, 27806];
  if (id === "rcip" || id === "rural_program") {
    return [
      { key: "rural", label: "Willing to live in a participating rural community", verdict: p.ruralOk === "yes" ? "meets" : p.ruralOk === "no" ? "not_met" : "needs_info", detail: p.ruralOk === "no" ? "You said you'd rather not live in a rural community." : "The community must recommend you, and you must intend to live there." },
      jobOfferReq(p, "in a participating community"),
      workReq(p, on, 3),
      langByTeer(p, on, (t) => (t <= 1 ? 6 : t <= 3 ? 5 : 4), "Language: CLB 6 (TEER 0 or 1), CLB 5 (TEER 2 or 3), CLB 4 (TEER 4 or 5)"),
      { key: "education", label: "Canadian high school or higher, or a foreign credential with an ECA", verdict: educationOk(p, "secondary"), detail: "An ECA must be under 5 years old when you apply." },
      fundsReq(p, rcipFunds, 2831, "July 29, 2025"),
    ];
  }
  if (id === "fcip") {
    const fr = p.frenchTest ? (() => { try { return scoresToClb(p.frenchTest!.type, p.frenchTest!); } catch { return null; } })() : null;
    return [
      jobOfferReq(p, "in a participating Francophone community"),
      workReq(p, on, 3),
      { key: "language", label: "French: NCLC 5 in all four abilities", verdict: !fr ? (p.learnFrench === "yes" ? "needs_info" : "not_met") : minClb(fr) >= 5 ? "meets" : "not_met", detail: fr ? `Your lowest French ability is NCLC ${minClb(fr)}.` : "This pilot needs a TEF Canada or TCF Canada result showing NCLC 5." },
      { key: "education", label: "Canadian high school or higher, or a foreign credential with an ECA", verdict: educationOk(p, "secondary"), detail: "" },
      fundsReq(p, rcipFunds, 2831, "July 29, 2025"),
    ];
  }
  if (id === "aip") {
    const teer = p.jobOfferTeer && p.jobOfferTeer !== "unknown" ? Number(p.jobOfferTeer) : null;
    return [
      jobOfferReq(p, "in Atlantic Canada"),
      workReq(p, on, 5),
      langByTeer(p, on, (t) => (t <= 3 ? 5 : 4), "Language: CLB 5 (TEER 0 to 3 offers), CLB 4 (TEER 4)"),
      { key: "education", label: teer !== null && teer <= 1 ? "One-year Canadian post-secondary credential or higher (or ECA)" : "Canadian high school or higher (or ECA)", verdict: educationOk(p, teer !== null && teer <= 1 ? "one_year" : "secondary"), detail: "" },
      fundsReq(p, [3815, 4750, 5840, 7090, 8042, 9070, 10098], 1028, "July 29, 2025"),
    ];
  }
  return null;
}

function eeRecommendation(r: ProgramResult, p: Profile, crs: number | null, cats: CategoryResult[]): Recommendation {
  const bucket = bucketOf(r.verdict);
  const reasons: string[] = [];
  const met = r.requirements.filter((x) => x.verdict === "meets");
  if (bucket === "potential") reasons.push("You meet every minimum requirement we can check, based on your answers.");
  else if (met.length) reasons.push(`You meet ${met.length} of ${r.requirements.length} requirements.`);
  const catHits = cats.filter((c) => c.verdict === "meets");
  if (bucket === "potential" && catHits.length) reasons.push(`You may also qualify for category rounds: ${catHits.map((c) => c.name).join(", ")}.`);
  if (crs !== null && bucket !== "not_now") reasons.push(`Your CRS score would be about ${crs}. Invitations go to the highest scores in each round, so a profile is not an invitation.`);
  if (r.points) reasons.push(`FSW selection grid: ${r.points.total} of 100 (pass mark ${r.points.pass}).`);
  let score = (bucket === "potential" ? 100 : bucket === "needs_info" ? 50 : 0) + STATUS_POINTS.invitation + (catHits.length ? 10 : 0);
  if (r.id === "cec" && AUTHORIZED.has(p.status ?? "")) score += 5;
  return {
    id: r.id,
    name: r.name,
    jurisdiction: "Federal (Express Entry)",
    kind: "express_entry",
    status: "invitation",
    statusNote: "Express Entry: you create a profile and IRCC invites the highest-ranked candidates in each round. Rounds paused while IRCC recalculated profiles after the November 3, 2026 changes.",
    bucket,
    score,
    reasons,
    gaps: r.requirements.filter((x) => x.verdict !== "meets").map((x) => `${x.label}: ${x.detail}`),
    requirements: r.requirements,
    checkedOnly: r.notes,
    documents: EE_DOCS,
    url: r.sourceUrl,
    verifiedAt: r.verifiedAt,
    extra: { crs: crs ?? undefined, fswPoints: r.points?.total, categories: r.id === "cec" ? cats : undefined },
  };
}

function programRecommendation(rec: ProgramRecord, p: Profile, on: Date, places: ReturnType<typeof placesFor>): Recommendation | null {
  if (rec.status === "closed" && rec.kind !== "pnp") return null;
  const reasons: string[] = [];
  const gaps: string[] = [];
  let score = STATUS_POINTS[rec.status];

  const reqs = communityReqs(rec.id, p, on);
  let bucket: Bucket;
  if (reqs) {
    const v = overall(reqs);
    bucket = rec.status === "opens_later" || rec.status === "closing" ? (v === "not_met" ? "not_now" : "needs_info") : bucketOf(v);
    gaps.push(...reqs.filter((x) => x.verdict !== "meets").map((x) => `${x.label}: ${x.detail}`));
    const met = reqs.filter((x) => x.verdict === "meets").length;
    if (met) reasons.push(`You meet ${met} of ${reqs.length} requirements we can check.`);
    score += bucket === "potential" ? 100 : bucket === "needs_info" ? 45 : 0;
    if (rec.id === "aip") {
      const fit = Math.max(...ATLANTIC.map((prov) => places.fit(prov).points));
      score += fit;
      if (fit < -20) gaps.push("You said you wouldn't move to Atlantic Canada.");
    }
  } else if (rec.kind === "pnp") {
    if (rec.status === "closed") return null;
    const fit = places.fit(rec.jurisdiction);
    if (fit.blocked) return null;
    if (fit.points <= 0 && !places.anywhere) return null; // not somewhere you'd live
    score += 30 + fit.points;
    if (fit.reason) reasons.push(fit.reason);
    if (rec.jobOfferRequired && p.jobOfferValid !== "yes") {
      gaps.push("This stream needs a job offer from an employer in the province.");
      score -= 15;
    } else if (rec.jobOfferRequired && p.jobOfferValid === "yes" && p.jobOfferProvince === rec.jurisdiction) {
      reasons.push(`You have a job offer in ${rec.jurisdiction}.`);
      score += 15;
    }
    if (rec.category === "international_graduate" && p.canadianCredentialType) {
      reasons.push("It is designed for graduates; check whether your school and province match.");
      score += 5;
    }
    if (rec.category === "express_entry") score += 5;
    if (rec.category === "french" && !p.frenchTest) score -= 10;
    if (rec.category === "entrepreneur") score -= 25;
    if (rec.status === "not_verified") gaps.push("We couldn't verify this program's streams or status.");
    bucket = "needs_info";
  } else {
    if (rec.kind === "quebec" && places.current !== "Quebec" && !places.preferred.has("Quebec")) return null;
    if (rec.kind === "family" && !(p.maritalStatus === "married" || p.maritalStatus === "common_law") ) return null;
    if (rec.kind === "family" && p.spouseIsCitizenOrPr !== "yes") return null;
    if (rec.kind === "family") reasons.push("Your spouse or partner is a Canadian citizen or PR, so sponsorship may be an option.");
    if (rec.kind === "quebec") reasons.push("You live in or would consider Quebec, which runs its own selection.");
    bucket = "needs_info";
    score += 20;
  }

  if (rec.status === "opens_later") reasons.push("Not open yet; plan ahead if it fits.");
  if (rec.status === "closing") reasons.push("Closing soon; only an option if you already have a community recommendation.");

  return {
    id: rec.id,
    name: rec.name,
    jurisdiction: rec.jurisdiction,
    kind: rec.kind,
    status: rec.status,
    statusNote: rec.statusNote,
    bucket,
    score,
    reasons,
    gaps,
    requirements: reqs,
    checkedOnly: reqs ? ["The employer's designation, the community's recommendation and the TEER match between your experience and the job are checked by others, not by us."] : ["We list this stream for you to check; we don't assess provincial eligibility in detail yet."],
    documents: reqs ? COMMUNITY_DOCS : [],
    url: rec.url,
    verifiedAt: rec.verifiedAt,
  };
}

function iso(d: Date) {
  return d.toISOString().slice(0, 10);
}

function plan(p: Profile, on: Date, ee: ReturnType<typeof assessExpressEntry>, flags: string[]): Milestone[] {
  const out: Milestone[] = [];
  if (flags.length) out.push({ title: "Speak to a licensed consultant or lawyer", detail: flags.join(" "), due: iso(on), href: "https://college-ic.ca/protecting-the-public/find-an-immigration-consultant", priority: "now" });

  if (p.permitExpiryDate && p.status && AUTHORIZED.has(p.status)) {
    const days = Math.ceil((new Date(p.permitExpiryDate + "T00:00:00Z").getTime() - on.getTime()) / DAY);
    if (days > 0 && days <= 365) {
      out.push({ title: "Decide how you'll keep your status", detail: `Your permit expires on ${p.permitExpiryDate}. Permanent residence usually takes longer than that. Apply for any extension or new permit before the expiry date to keep maintained status.`, due: p.permitExpiryDate, href: "https://www.canada.ca/en/immigration-refugees-citizenship/services/work-canada.html", priority: days <= 120 ? "now" : "soon" });
    }
  }

  const lang = languageOf(p, on);
  if (!lang.first) out.push({ title: "Take an approved language test", detail: "IELTS General Training, CELPIP-General or PTE Core for English; TEF Canada or TCF Canada for French. Results last 2 years.", due: null, href: "https://www.canada.ca/en/immigration-refugees-citizenship/services/immigrate-canada/express-entry/documents/language-test.html", priority: "now" });
  else if (minClb(lang.first) < 7) out.push({ title: "Aim for CLB 7 in all four abilities", detail: `Your lowest ability is level ${minClb(lang.first)}. CLB 7 opens the Federal Skilled Worker Program and CEC for TEER 0 or 1 jobs, and raises your CRS.`, due: null, priority: "soon" });
  else if (minClb(lang.first) < 9) out.push({ title: "Consider retaking your test for CLB 9", detail: "CLB 9 in all four abilities adds the most CRS points through language and skill transferability. Try it in the CRS calculator first.", due: null, href: "/crs", priority: "later" });

  if (p.educationEarnedIn === "foreign" && p.ecaStatus !== "completed") out.push({ title: "Get an Educational Credential Assessment", detail: "Foreign education only counts for Express Entry with an ECA from a designated organization.", due: null, href: "https://www.canada.ca/en/immigration-refugees-citizenship/services/immigrate-canada/express-entry/documents/education-assessed.html", priority: "soon" });

  if ((p.jobs ?? []).some((j) => !j.nocCode)) out.push({ title: "Confirm the NOC code for each job", detail: "Programs and categories depend on your NOC code, decided by your duties. Use the NOC finder.", due: null, href: "/noc", priority: "soon" });

  const cec = ee.programs.find((x) => x.id === "cec")!;
  if (cec.requirements.find((r) => r.key === "work")?.verdict === "not_met") {
    const current = (p.jobs ?? []).filter((j) => j.current && j.country === "canada" && isSkilled(j) && j.paid !== false && !j.selfEmployed && !j.whileFullTimeStudent);
    const weekly = Math.min(30, current.reduce((s, j) => s + (j.hoursPerWeek ?? 0), 0));
    if (weekly > 0) {
      const have = creditedHours((p.jobs ?? []).filter((j) => j.country === "canada" && isSkilled(j) && j.paid !== false && !j.selfEmployed && !j.whileFullTimeStudent), on, 3);
      const weeks = Math.ceil((YEAR_HOURS - have) / weekly);
      const date = new Date(on.getTime() + weeks * 7 * DAY);
      out.push({ title: "Reach 1 year of skilled Canadian work", detail: `At ${weekly} counted hours a week you'd reach 1,560 hours around ${iso(date)}, if nothing changes. This is an estimate.`, due: iso(date), priority: "soon" });
    }
  }

  if (ee.anyProgram) out.push({ title: "Create your Express Entry profile", detail: "You appear to meet at least one program's minimums. A profile puts you in the pool; it does not guarantee an invitation.", due: null, href: "https://www.canada.ca/en/immigration-refugees-citizenship/services/immigrate-canada/express-entry.html", priority: "soon" });
  if (p.englishTest?.date) {
    const exp = new Date(p.englishTest.date + "T00:00:00Z");
    exp.setUTCFullYear(exp.getUTCFullYear() + 2);
    if (exp.getTime() - on.getTime() < 300 * DAY) out.push({ title: "Your language result expires soon", detail: "Results must be under 2 years old when you create a profile and when you apply.", due: iso(exp), priority: "soon" });
  }

  const rank = { now: 0, soon: 1, later: 2 };
  return out.sort((a, b) => rank[a.priority] - rank[b.priority] || (a.due ?? "9999").localeCompare(b.due ?? "9999"));
}

export function recommend(p: Profile, on: Date): RecommendationReport {
  const ee = assessExpressEntry(p, on);
  const derived = deriveCrs(p, on);
  const crs = derived.input ? calculateCrs(derived.input, ruleSetFor(on)).total : null;
  const places = placesFor(p);
  const all: Recommendation[] = [
    ...ee.programs.map((r) => eeRecommendation(r, p, crs, ee.categories)),
    ...PROGRAMS.map((r) => programRecommendation(r, p, on, places)).filter((x): x is Recommendation => x !== null),
  ];
  // Quebec residents who won't leave Quebec: Express Entry doesn't apply.
  const sorted = all.sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));
  return {
    generatedAt: on.toISOString(),
    potential: sorted.filter((r) => r.bucket === "potential"),
    needsInfo: sorted.filter((r) => r.bucket === "needs_info"),
    notNow: sorted.filter((r) => r.bucket === "not_now"),
    plan: plan(p, on, ee, professionalFlags(p)),
    flags: professionalFlags(p),
  };
}
