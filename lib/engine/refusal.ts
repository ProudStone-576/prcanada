/**
 * Refusal letter analysis. Deterministic pattern matching over the letter's
 * text; legal references are limited to provisions verified on the Justice
 * Laws site (IRPA and IRPR, current to 2026-10-29). It explains and flags; it
 * never concludes that a decision was wrong and never recommends reapplying
 * by default.
 */

export const LAW_VERIFIED = "2026-11-17";
export const IRPA_URL = "https://laws-lois.justice.gc.ca/eng/acts/i-2.5/";
export const IRPR_URL = "https://laws-lois.justice.gc.ca/eng/regulations/SOR-2002-227/";

export type AppType = "study_permit" | "work_permit" | "pgwp" | "visitor_visa" | "visitor_record" | "extension" | "restoration" | "permanent_residence" | "sponsorship" | "unknown";

export const APP_LABEL: Record<AppType, string> = {
  study_permit: "Study permit",
  work_permit: "Work permit",
  pgwp: "Post-graduation work permit",
  visitor_visa: "Visitor visa (temporary resident visa)",
  visitor_record: "Visitor record (extension of stay)",
  extension: "Extension or change of status in Canada",
  restoration: "Restoration of status",
  permanent_residence: "Permanent residence",
  sponsorship: "Sponsorship",
  unknown: "Not identified",
};

export interface Ground {
  key: string;
  title: string;
  plain: string;
  law: Array<{ cite: string; summary: string; url: string }>;
  evidence: string[];
  quote: string;
}

export type FlagKey = "misrepresentation" | "criminality" | "security" | "human_rights" | "health" | "non_compliance" | "procedural_fairness" | "status_loss";

export interface Flag {
  key: FlagKey;
  title: string;
  why: string;
}

export interface Deadline {
  title: string;
  date: string | null;
  basis: string;
  urgent: boolean;
}

export interface NextStep {
  key: "professional" | "judicial_review" | "restoration" | "reconsideration" | "new_application" | "other_pathways" | "gcms_notes";
  title: string;
  kind: "legal_challenge" | "administrative" | "advice" | "information";
  when: string;
  caution: string;
}

export interface RefusalInput {
  text: string;
  notifiedOn?: string; // date the person received the decision
  where?: "in_canada" | "outside_canada" | "unknown";
}

export interface RefusalResult {
  appType: AppType;
  appTypeEvidence: string | null;
  grounds: Ground[];
  flags: Flag[];
  deadlines: Deadline[];
  nextSteps: NextStep[];
  needsProfessional: boolean;
  readable: boolean;
  notes: string[];
}

const law = {
  a11: { cite: "IRPA s. 11(1)", summary: "An officer issues a visa or document only if satisfied you're not inadmissible and meet the Act's requirements.", url: `${IRPA_URL}page-2.html` },
  a16: { cite: "IRPA s. 16(1)", summary: "You must answer truthfully and produce the documents and evidence the officer reasonably requires.", url: `${IRPA_URL}page-3.html` },
  a20: { cite: "IRPA s. 20(1)(b)", summary: "A temporary resident must show they will leave Canada by the end of their authorized stay.", url: `${IRPA_URL}page-4.html` },
  a36: { cite: "IRPA s. 36", summary: "Inadmissibility for serious criminality (36(1)) or criminality (36(2)).", url: `${IRPA_URL}page-6.html` },
  a34: { cite: "IRPA s. 34", summary: "Inadmissibility on security grounds.", url: `${IRPA_URL}page-6.html` },
  a35: { cite: "IRPA s. 35", summary: "Inadmissibility for violating human or international rights.", url: `${IRPA_URL}page-6.html` },
  a38: { cite: "IRPA s. 38(1)", summary: "Inadmissibility on health grounds: danger to public health or safety, or excessive demand on services.", url: `${IRPA_URL}page-6.html` },
  a39: { cite: "IRPA s. 39", summary: "Inadmissibility for financial reasons: unable or unwilling to support yourself and your dependants.", url: `${IRPA_URL}page-6.html` },
  a40: { cite: "IRPA s. 40(1)(a) and 40(2)(a)", summary: "Misrepresenting or withholding material facts makes you inadmissible, generally for five years.", url: `${IRPA_URL}page-6.html` },
  a41: { cite: "IRPA s. 41", summary: "Inadmissibility for failing to comply with the Act, such as working or staying without authorization.", url: `${IRPA_URL}page-6.html` },
  a72: { cite: "IRPA s. 72(1) and 72(2)(b)", summary: "Judicial review needs leave from the Federal Court, applied for within 15 days (decision in Canada) or 60 days (outside Canada).", url: `${IRPA_URL}page-9.html` },
  r179: { cite: "IRPR s. 179(b)", summary: "A visitor visa is issued only if you'll leave Canada by the end of your authorized stay.", url: `${IRPR_URL}page-25.html` },
  r182: { cite: "IRPR s. 182", summary: "Restoration of visitor, worker or student status, applied for within 90 days of losing it, in the situations the section lists.", url: `${IRPR_URL}page-25.html` },
  r183: { cite: "IRPR s. 183(5) and (6)", summary: "If you applied to extend before your status expired, you keep your status until a decision is made (maintained status).", url: `${IRPR_URL}page-25.html` },
  r200: { cite: "IRPR s. 200(1)(b)", summary: "A work permit is issued only if you'll leave Canada by the end of your authorized stay.", url: `${IRPR_URL}page-27.html` },
  r216: { cite: "IRPR s. 216(1)(b)", summary: "A study permit is issued only if you'll leave Canada by the end of your authorized stay.", url: `${IRPR_URL}page-31.html` },
  r220: { cite: "IRPR s. 220", summary: "A study permit needs enough available money for tuition, living costs and travel, without working in Canada.", url: `${IRPR_URL}page-32.html` },
  r2201: { cite: "IRPR s. 220.1(1)", summary: "Study permit holders must enrol at their school, stay enrolled and actively pursue their studies.", url: `${IRPR_URL}page-32.html` },
};

const TYPE_RULES: Array<[AppType, RegExp]> = [
  ["pgwp", /post[- ]graduation work permit|\bPGWP\b/i],
  ["restoration", /restor(e|ation) (of )?(your )?(temporary resident )?status/i],
  ["sponsorship", /sponsor(ship)?\b.*(spouse|partner|parent|family)|family class/i],
  ["permanent_residence", /permanent resid(ence|ent)|express entry|canadian experience class|federal skilled|provincial nominee/i],
  ["study_permit", /study permit/i],
  ["work_permit", /work permit/i],
  ["visitor_record", /visitor record|extend your stay/i],
  ["visitor_visa", /temporary resident visa|visitor visa|\bTRV\b/i],
];

interface Pattern {
  key: string;
  re: RegExp;
  title: string;
  plain: string;
  law: (t: AppType) => Ground["law"];
  evidence: string[];
}

const leaveLaw = (t: AppType) => (t === "study_permit" ? [law.r216, law.a20] : t === "work_permit" || t === "pgwp" ? [law.r200, law.a20] : t === "visitor_visa" ? [law.r179, law.a20] : [law.a20]);

const PATTERNS: Pattern[] = [
  {
    key: "leave_end_of_stay",
    re: /satisfied that you will leave canada (at|by) the end of (your|the) (stay|period)/i,
    title: "The officer wasn't satisfied you'd leave Canada at the end of your stay",
    plain: "Temporary permits and visas require showing you'll leave when your authorized stay ends. The letter usually lists the factors behind this, covered separately below.",
    law: leaveLaw,
    evidence: ["Evidence of ties outside Canada: ongoing job, property, family responsibilities", "A clear explanation of your plans after this stay"],
  },
  {
    key: "family_ties",
    re: /family ties|ties to your country|significant (family )?ties in canada/i,
    title: "Family ties in Canada or at home",
    plain: "The officer weighed your family connections, in Canada or in your home country, against your intention to leave.",
    law: leaveLaw,
    evidence: ["Proof of close family and responsibilities in your home country", "If your family is in Canada, an explanation of why you'll still leave when required"],
  },
  {
    key: "purpose",
    re: /purpose of (your )?(visit|travel|stay)|not consistent with a temporary stay/i,
    title: "The purpose of your visit",
    plain: "The officer wasn't convinced the reason you gave fits a temporary stay.",
    law: (t) => [...leaveLaw(t), law.a11],
    evidence: ["A detailed, consistent explanation of why you're coming and for how long", "Supporting documents: invitation letter, itinerary, event registration"],
  },
  {
    key: "financial",
    re: /financial (status|resources|situation)|sufficient (and available )?(funds|financial)|personal assets|funds (available|to support)|bank (statements|balance)/i,
    title: "Your finances",
    plain: "The officer wasn't satisfied you have enough money available, or that its source and history are clear.",
    law: (t) => (t === "study_permit" ? [law.r220, ...leaveLaw(t)] : [...leaveLaw(t), law.a39]),
    evidence: ["Bank statements showing the balance over several months, not just a recent deposit", "Proof of where large deposits came from", "Sponsor's income documents and relationship to you, if someone else pays"],
  },
  {
    key: "travel_history",
    re: /travel history/i,
    title: "Your travel history",
    plain: "Limited previous travel gave the officer less evidence that you return home after trips abroad.",
    law: leaveLaw,
    evidence: ["Copies of previous visas and entry stamps, including other countries"],
  },
  {
    key: "employment",
    re: /employment (prospects|situation)|current employment|employment in your country/i,
    title: "Your job or career situation",
    plain: "The officer looked at your current job or prospects and wasn't convinced they tie you to returning.",
    law: leaveLaw,
    evidence: ["Employer letter confirming your job, leave and return date", "For students: how the program fits your career plans at home"],
  },
  {
    key: "study_plan",
    re: /study plan|reasonable (choice|progression) of stud|(choice|purpose) of (the )?(program|course) of study|in light of your educational (background|history)/i,
    title: "Your study plan",
    plain: "The officer questioned why you chose this program, or how it fits your past studies and future plans.",
    law: (t) => [law.r216, law.a11, ...(t === "study_permit" ? [] : [])],
    evidence: ["A specific study plan linking your background, this program and your career", "Why this school and program rather than options at home"],
  },
  {
    key: "immigration_status",
    re: /immigration status in your country of residence|status in your country of residence/i,
    title: "Your status where you live now",
    plain: "Temporary or uncertain status in your current country of residence weighed against you.",
    law: leaveLaw,
    evidence: ["Proof of your long-term status where you live"],
  },
  {
    key: "language",
    re: /language (test|results|ability|proficiency|requirement)[^.]{0,80}(not|below|insufficient|do(es)? not meet)|(not|did not|does not) meet[^.]{0,40}language/i,
    title: "Language results",
    plain: "The officer found your language test results missing or below the level this application needs.",
    law: () => [law.a11],
    evidence: ["Approved test results at or above the required level, less than 2 years old"],
  },
  {
    key: "documents",
    re: /(did not|failed to|have not) (provide|submit)|incomplete application|insufficient (documentation|documents)|missing (documents|information)/i,
    title: "Missing or insufficient documents",
    plain: "The officer says required documents or information were missing or not enough.",
    law: () => [law.a16, law.a11],
    evidence: ["Compare your submission with the current checklist for this application and add what's missing"],
  },
  {
    key: "eligibility",
    re: /do(es)? not meet the (requirements|eligibility)|not eligible|ineligible/i,
    title: "Eligibility requirements not met",
    plain: "The officer found you didn't meet one of the program's requirements. The letter should say which.",
    law: () => [law.a11],
    evidence: ["Check the specific requirement named against the program's official page"],
  },
  {
    key: "study_conditions",
    re: /actively pursu|not enrolled|enrol(l)?ment|220\.1/i,
    title: "Study permit conditions",
    plain: "The officer found you weren't enrolled or actively studying as your permit required.",
    law: () => [law.r2201],
    evidence: ["Enrolment letters and transcripts for every term, and any authorized leave"],
  },
];

const FLAG_RULES: Array<{ key: FlagKey; re: RegExp; title: string; why: string }> = [
  { key: "misrepresentation", re: /misrepresent|40\(1\)|withh(o|e)ld(ing)? material facts|section 40 of/i, title: "Misrepresentation", why: "A misrepresentation finding usually makes a person inadmissible for five years (IRPA s. 40(2)(a)) and can affect every future application." },
  { key: "criminality", re: /criminal|\b36\(1\)|\b36\(2\)|section 36 of/i, title: "Criminality", why: "Criminal inadmissibility has its own remedies, such as rehabilitation, that need a professional's assessment." },
  { key: "security", re: /security grounds|\b34\(1\)|section 34 of/i, title: "Security inadmissibility", why: "Security findings are serious and need a lawyer." },
  { key: "human_rights", re: /human or international rights|\b35\(1\)|section 35 of/i, title: "Human or international rights", why: "These findings are serious and need a lawyer." },
  { key: "health", re: /health grounds|medical (condition|inadmissib)|excessive demand|\b38\(1\)/i, title: "Health inadmissibility", why: "Health findings can sometimes be answered with a mitigation plan; a professional should advise." },
  { key: "non_compliance", re: /non-?compliance|without authori[sz]ation|unauthori[sz]ed (work|study)|overst(ay|ayed)|section 41 of|\b41\(a\)/i, title: "Non-compliance", why: "Working, studying or staying without authorization can affect status and future applications." },
  { key: "procedural_fairness", re: /procedural fairness|fairness letter|opportunity to respond|you have \d+ days to respond/i, title: "Procedural fairness letter", why: "This may be a letter asking you to respond to concerns before a decision. Responding well, on time, matters a great deal." },
  { key: "status_loss", re: /must leave canada|leave canada immediately|no longer (have|hold) (legal |temporary resident )?status|out of status|removal order|departure order|exclusion order/i, title: "Loss of status", why: "If your status has ended, time limits for restoration and other options are short." },
];

const DAY = 86400_000;
const addDays = (iso: string, n: number) => new Date(new Date(iso + "T00:00:00Z").getTime() + n * DAY).toISOString().slice(0, 10);

function sentenceAround(text: string, index: number): string {
  const start = Math.max(text.lastIndexOf(".", index - 1) + 1, text.lastIndexOf("\n", index - 1) + 1, index - 200);
  const endDot = text.indexOf(".", index);
  const endNl = text.indexOf("\n", index);
  const end = Math.min(...[endDot === -1 ? text.length : endDot + 1, endNl === -1 ? text.length : endNl, index + 250]);
  return text.slice(start, end).replace(/\s+/g, " ").trim();
}

export function analyzeRefusal(input: RefusalInput, on: Date): RefusalResult {
  const text = input.text.replace(/\r/g, "").slice(0, 50_000);
  const notes: string[] = [];
  const readable = text.trim().split(/\s+/).length >= 25;

  let appType: AppType = "unknown";
  let appTypeEvidence: string | null = null;
  for (const [t, re] of TYPE_RULES) {
    const m = text.match(re);
    if (m) {
      appType = t;
      appTypeEvidence = sentenceAround(text, m.index!);
      break;
    }
  }
  if (appType === "work_permit" && /extend|extension|change (the )?conditions/i.test(text)) notes.push("This looks like a refusal of an extension or change made from inside Canada.");

  const grounds: Ground[] = [];
  for (const p of PATTERNS) {
    const m = text.match(p.re);
    if (m) grounds.push({ key: p.key, title: p.title, plain: p.plain, law: p.law(appType), evidence: p.evidence, quote: sentenceAround(text, m.index!) });
  }

  const flags: Flag[] = [];
  for (const f of FLAG_RULES) if (f.re.test(text)) flags.push({ key: f.key, title: f.title, why: f.why });

  const inCanadaApp = appType === "extension" || appType === "visitor_record" || appType === "restoration" || appType === "pgwp" || /extend|extension|change (the )?conditions|inside canada|in canada/i.test(text);
  const where = input.where && input.where !== "unknown" ? input.where : inCanadaApp ? "in_canada" : "unknown";
  if (where === "in_canada" && (appType === "pgwp" || /extend|extension/i.test(text)) && !flags.some((f) => f.key === "status_loss")) {
    flags.push({ key: "status_loss", title: "Possible loss of status", why: "When an extension or PGWP made from inside Canada is refused, maintained status (IRPR s. 183(5)-(6)) generally ends with the decision. Check your status today." });
  }

  const deadlines: Deadline[] = [];
  const jrDays = where === "in_canada" ? 15 : where === "outside_canada" ? 60 : null;
  if (input.notifiedOn && jrDays) {
    const date = addDays(input.notifiedOn, jrDays);
    deadlines.push({ title: "Last day to apply for leave for judicial review", date, basis: `IRPA s. 72(2)(b): ${jrDays} days from when you were notified, for a decision made ${where === "in_canada" ? "in" : "outside"} Canada. A judge can extend it only for special reasons.`, urgent: true });
  } else {
    deadlines.push({ title: "Judicial review time limit", date: null, basis: "IRPA s. 72(2)(b): 15 days for a decision made in Canada, 60 days outside Canada, counted from when you were notified. Tell us the date you received the decision to calculate it.", urgent: true });
  }
  if (flags.some((f) => f.key === "status_loss") && input.notifiedOn) {
    deadlines.push({ title: "Restoration window (if it applies to you)", date: addDays(input.notifiedOn, 90), basis: "IRPR s. 182: within 90 days of losing status, in the situations the section covers. Counted here from the decision date; your status may have ended on a different date.", urgent: true });
  }
  if (flags.some((f) => f.key === "procedural_fairness")) {
    const m = text.match(/(\d{1,3})\s*(calendar )?days/i);
    deadlines.push({ title: "Response to the procedural fairness letter", date: m && input.notifiedOn ? addDays(input.notifiedOn, Number(m[1])) : null, basis: m ? `The letter mentions ${m[1]} days. Check the exact deadline in the letter.` : "Check the letter for the response deadline.", urgent: true });
  }

  const needsProfessional = flags.length > 0 || grounds.length === 0 || appType === "permanent_residence" || appType === "sponsorship";

  const nextSteps: NextStep[] = [];
  nextSteps.push({
    key: "professional",
    title: "Get advice from a licensed professional",
    kind: "advice",
    when: needsProfessional ? "Strongly advised for this letter, before you do anything else." : "Worth it before deciding between a new application and a challenge.",
    caution: "Only authorized representatives may charge to help you, such as licensed consultants (RCIC) and lawyers. IRCC explains who qualifies.",
  });
  if (jrDays !== null || where === "unknown") {
    nextSteps.push({
      key: "judicial_review",
      title: "Judicial review in the Federal Court",
      kind: "legal_challenge",
      when: "If the decision may be unreasonable or unfair, for example it ignored evidence you sent or gave no real reasons.",
      caution: "A legal challenge, not a new application. Strict deadline; you need a lawyer. If it succeeds the court usually sends your file back for a new decision; it doesn't grant the permit.",
    });
  }
  if (flags.some((f) => f.key === "status_loss")) {
    nextSteps.push({
      key: "restoration",
      title: "Restoration of status",
      kind: "administrative",
      when: "If your temporary status ended and you're within 90 days and meet the conditions.",
      caution: "While waiting, you normally can't work or study. If restoration is refused, you have to leave Canada.",
    });
  }
  nextSteps.push({
    key: "gcms_notes",
    title: "Ask for the officer's notes",
    kind: "information",
    when: "To see the officer's full reasoning before you decide. You can request your file notes through an access to information or privacy request.",
    caution: "These requests take time, so don't let them make you miss a court deadline.",
  });
  nextSteps.push({
    key: "reconsideration",
    title: "Ask the office to reconsider",
    kind: "administrative",
    when: "If there's a clear error, such as a document the officer missed that is in your file.",
    caution: "Officers don't have to reconsider, and asking doesn't stop the judicial review deadline.",
  });
  nextSteps.push({
    key: "new_application",
    title: "Apply again with stronger evidence",
    kind: "administrative",
    when: "Only once the officer's concerns can be answered with new evidence or a real change in your situation.",
    caution: "An administrative step that doesn't challenge the refusal. Reapplying with the same documents usually leads to the same result, and every refusal stays on your record.",
  });
  nextSteps.push({ key: "other_pathways", title: "Look at other pathways", kind: "information", when: "If a different permit or program fits your situation better.", caution: "Check your current status first." });

  if (!readable) notes.push("The text is too short to analyze. Paste the full letter, including the reasons section.");
  if (readable && grounds.length === 0) notes.push("We couldn't find the reasons in this text. Some letters only tick boxes; others give reasons in an attached note. A professional can read it with you.");
  return { appType, appTypeEvidence, grounds, flags, deadlines, nextSteps, needsProfessional, readable, notes };
}
