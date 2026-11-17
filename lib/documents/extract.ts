/**
 * Field suggestions from a document's text. Pure and deterministic: regular
 * expressions over the text layer, never guesses. Every value is shown to the
 * person as a suggestion to confirm; nothing is written to their profile or
 * the document without their action.
 */
import type { DocType, ExtractedFields } from "./types";

const MONTHS: Record<string, number> = {
  jan: 1, january: 1, janvier: 1, feb: 2, february: 2, fevrier: 2, février: 2, mar: 3, march: 3, mars: 3, apr: 4, april: 4, avril: 4,
  may: 5, mai: 5, jun: 6, june: 6, juin: 6, jul: 7, july: 7, juillet: 7, aug: 8, august: 8, aout: 8, août: 8, sep: 9, sept: 9, september: 9, septembre: 9,
  oct: 10, october: 10, octobre: 10, nov: 11, november: 11, novembre: 11, dec: 12, december: 12, decembre: 12, décembre: 12,
};

const pad = (n: number) => String(n).padStart(2, "0");
function valid(y: number, m: number, d: number) {
  if (y < 1950 || y > 2100 || m < 1 || m > 12 || d < 1 || d > 31) return null;
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCMonth() === m - 1 ? `${y}-${pad(m)}-${pad(d)}` : null;
}

const MON = "(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?|janvier|f[ée]vrier|mars|avril|mai|juin|juillet|ao[uû]t|septembre|octobre|novembre|d[ée]cembre)";

/** All unambiguous dates in a string, in order. Numeric day/month orders like 03/04/2026 are skipped as ambiguous. */
export function findDates(s: string): string[] {
  const out: Array<{ i: number; v: string }> = [];
  const push = (i: number, v: string | null) => v && out.push({ i, v });
  for (const m of s.matchAll(/\b(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})\b/g)) push(m.index!, valid(+m[1], +m[2], +m[3]));
  for (const m of s.matchAll(new RegExp(`\\b(\\d{1,2})(?:st|nd|rd|th)?[ -](?:of )?${MON}\\.?,?[ -](\\d{4})\\b`, "gi"))) push(m.index!, valid(+m[3], MONTHS[m[2].toLowerCase().normalize("NFC")] ?? MONTHS[m[2].toLowerCase().slice(0, 3)], +m[1]));
  for (const m of s.matchAll(new RegExp(`\\b${MON}\\.? (\\d{1,2})(?:st|nd|rd|th)?,? (\\d{4})\\b`, "gi"))) push(m.index!, valid(+m[3], MONTHS[m[1].toLowerCase()] ?? MONTHS[m[1].toLowerCase().slice(0, 3)], +m[2]));
  for (const m of s.matchAll(new RegExp(`\\b(\\d{4})[ -]${MON}[ -](\\d{1,2})\\b`, "gi"))) push(m.index!, valid(+m[1], MONTHS[m[2].toLowerCase()] ?? MONTHS[m[2].toLowerCase().slice(0, 3)], +m[3]));
  return out.sort((a, b) => a.i - b.i).map((x) => x.v);
}

/** The first date that appears within `window` characters after a label. */
export function dateAfter(text: string, label: RegExp, window = 80): string | undefined {
  for (const m of text.matchAll(new RegExp(label.source, label.flags.includes("g") ? label.flags : label.flags + "g"))) {
    const d = findDates(text.slice(m.index! + m[0].length, m.index! + m[0].length + window))[0];
    if (d) return d;
  }
  return undefined;
}

function score(text: string, ability: string): number | undefined {
  const m = text.match(new RegExp(`\\b${ability}\\b[^0-9\\n]{0,20}(\\d{1,3}(?:\\.\\d)?)`, "i"));
  return m ? Number(m[1]) : undefined;
}

const ECA_LEVELS: Array<[RegExp, string]> = [
  [/doctor(al|ate)|ph\.?\s?d/i, "doctoral"],
  [/master'?s/i, "masters_or_professional"],
  [/two or more/i, "two_or_more"],
  [/bachelor'?s/i, "bachelors_or_three_year"],
  [/two[- ]year/i, "two_year"],
  [/one[- ]year/i, "one_year"],
  [/secondary|high school/i, "secondary"],
];

export function extractFields(type: DocType, text: string): ExtractedFields {
  const t = text.replace(/\r/g, "");
  const f: ExtractedFields = { notes: [] };

  if (["passport", "study_permit", "work_permit", "visitor_record", "nomination_certificate"].includes(type)) {
    f.expiresOn = dateAfter(t, /(date of expiry|expiry date|expiration date|expires on|expires|valid until|date d'expiration|expiration)/i);
    f.issuedOn = dateAfter(t, /(date of issue|issue date|date issued|issued on|date de d[ée]livrance)/i);
    if (type === "work_permit") {
      const emp = t.match(/employer\s*[:/]?\s*([^\n]{3,80})/i);
      if (emp) f.employer = emp[1].trim();
    }
    if (type === "nomination_certificate") {
      const prov = t.match(/\b(Alberta|British Columbia|Manitoba|New Brunswick|Newfoundland and Labrador|Northwest Territories|Nova Scotia|Ontario|Prince Edward Island|Saskatchewan|Yukon)\b/);
      if (prov) f.province = prov[1];
    }
  }

  if (type === "language_test") {
    const kind = /celpip/i.test(t) ? "celpip_g" : /pte/i.test(t) ? "pte_core" : /tef/i.test(t) ? "tef_canada" : /tcf/i.test(t) ? "tcf_canada" : /ielts/i.test(t) ? "ielts_gt" : undefined;
    if (kind) f.testType = kind;
    if (/ielts/i.test(t) && /academic/i.test(t)) f.notes.push("This looks like IELTS Academic, which Express Entry does not accept.");
    f.testDate = dateAfter(t, /(test date|date of test|date de l'examen|date du test|date)/i);
    const fr = kind === "tef_canada" || kind === "tcf_canada";
    f.scores = {
      listening: score(t, fr ? "(?:listening|compr[ée]hension de l'oral|CO)" : "listening"),
      reading: score(t, fr ? "(?:reading|compr[ée]hension de l'[ée]crit|CE)" : "reading"),
      writing: score(t, fr ? "(?:writing|expression [ée]crite|EE)" : "writing"),
      speaking: score(t, fr ? "(?:speaking|expression orale|EO)" : "speaking"),
    };
    if (Object.values(f.scores).every((v) => v === undefined)) delete f.scores;
  }

  if (type === "employment_letter") {
    const hours = t.match(/(\d{1,2}(?:\.\d)?)\s*(?:hours|hrs)\s*(?:per|a|\/)\s*week/i);
    if (hours) f.hoursPerWeek = Number(hours[1]);
    const pay = t.match(/\$\s?[\d,]+(?:\.\d{2})?\s*(?:per|an|a|\/)\s*(hour|hr|year|annum|month|week)/i);
    if (pay) f.salary = pay[0].replace(/\s+/g, " ");
    const title = t.match(/(?:position|job title|title|role)\s*(?:of|as|:)\s*([^\n.,]{3,60}?)(?=\s+(?:since|from|at|with|for|starting|beginning)\b|[\n.,]|$)/i);
    if (title) f.jobTitle = title[1].trim();
    f.startDate = dateAfter(t, /(since|from|start(?:ed|ing)? (?:on|date)?|employed (?:with us )?(?:since|from))/i, 40);
    f.endDate = dateAfter(t, /(\bto\b|until|end(?:ed|ing)? (?:on|date)?)/i, 40);
    f.hasDuties = /dut(y|ies)|responsibilit/i.test(t);
    f.mentionsSignature = /sincerely|regards|signature|signed/i.test(t);
    if (!f.hoursPerWeek) f.notes.push("We couldn't find hours per week. IRCC asks for them.");
    if (!f.salary) f.notes.push("We couldn't find the salary. IRCC asks for salary and benefits.");
    if (!f.hasDuties) f.notes.push("We couldn't find a list of duties. IRCC compares them with your NOC.");
  }

  if (type === "eca") {
    const eq = t.match(/(canadian equivalen\w*|equivalent to|equivalency)[^\n]{0,160}/i);
    if (eq) for (const [re, level] of ECA_LEVELS) if (re.test(eq[0])) { f.ecaLevel = level; break; }
    f.issuedOn = dateAfter(t, /(date of issue|issue date|date issued|report date|issued on|date)/i);
  }

  if (type === "t4" || type === "noa") {
    const y = t.match(/\b(20\d{2})\b/);
    if (y) f.taxYear = y[1];
  }

  return f;
}
