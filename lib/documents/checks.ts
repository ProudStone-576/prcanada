/**
 * Document checks against the person's profile: expired or expiring documents,
 * dates and scores that don't match what they told us, and gaps in reference
 * letters. Pure. Findings are prompts to check, never conclusions.
 */
import type { Profile } from "../profile/schema";
import { DOC_TYPES, type DocMeta, type DocType } from "./types";

export interface StoredDoc {
  id: string;
  docType: DocType;
  createdAt: string;
  meta: DocMeta;
}

export interface Finding {
  docId: string;
  level: "problem" | "check";
  message: string;
}

const DAY = 86400_000;
const days = (iso: string, on: Date) => Math.ceil((new Date(iso + "T00:00:00Z").getTime() - on.getTime()) / DAY);

/** The expiry date to use: what the person confirmed, else the rule for that document type, else the suggestion. */
export function expiryOf(d: StoredDoc): string | undefined {
  if (d.meta.confirmed.expiresOn) return d.meta.confirmed.expiresOn;
  if (d.docType === "language_test" && (d.meta.confirmed.issuedOn ?? d.meta.suggested.testDate)) {
    const base = new Date((d.meta.confirmed.issuedOn ?? d.meta.suggested.testDate) + "T00:00:00Z");
    base.setUTCFullYear(base.getUTCFullYear() + 2);
    return base.toISOString().slice(0, 10);
  }
  if (d.docType === "eca" && (d.meta.confirmed.issuedOn ?? d.meta.suggested.issuedOn)) {
    const base = new Date((d.meta.confirmed.issuedOn ?? d.meta.suggested.issuedOn) + "T00:00:00Z");
    base.setUTCFullYear(base.getUTCFullYear() + 5);
    return base.toISOString().slice(0, 10);
  }
  return d.meta.suggested.expiresOn;
}

const close = (a?: number, b?: number) => a === undefined || b === undefined || Math.abs(a - b) < 0.01;
const norm = (s?: string) => (s ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");

export function checkDocuments(docs: StoredDoc[], p: Profile, on: Date): Finding[] {
  const out: Finding[] = [];
  for (const d of docs) {
    const label = DOC_TYPES[d.docType].label;
    const exp = expiryOf(d);
    if (exp) {
      const n = days(exp, on);
      if (n < 0) out.push({ docId: d.id, level: "problem", message: `${label} expired on ${exp}.` });
      else if (n <= 90) out.push({ docId: d.id, level: "check", message: `${label} expires on ${exp}, in ${n} days.` });
    } else if (DOC_TYPES[d.docType].hasExpiry) {
      out.push({ docId: d.id, level: "check", message: `Add the expiry or issue date for this ${label.toLowerCase()} so we can track it.` });
    }

    const s = d.meta.suggested;
    if ((d.docType === "work_permit" || d.docType === "study_permit") && s.expiresOn && p.permitExpiryDate && s.expiresOn !== p.permitExpiryDate && !d.meta.confirmed.expiresOn) {
      out.push({ docId: d.id, level: "check", message: `This ${label.toLowerCase()} seems to expire on ${s.expiresOn}, but your profile says ${p.permitExpiryDate}. If it's your current permit, one of them needs correcting.` });
    }

    if (d.docType === "language_test") {
      const test = s.testType && (s.testType === "tef_canada" || s.testType === "tcf_canada") ? p.frenchTest : p.englishTest;
      if (test && s.scores) {
        const diff = (["listening", "reading", "writing", "speaking"] as const).filter((a) => !close(s.scores?.[a], test[a]));
        if (diff.length) out.push({ docId: d.id, level: "problem", message: `Scores in this document differ from your profile for ${diff.join(", ")}. Your profile must match your official results exactly.` });
      }
      if (test?.date && s.testDate && test.date !== s.testDate) out.push({ docId: d.id, level: "check", message: `The test date here (${s.testDate}) differs from your profile (${test.date}).` });
    }

    if (d.docType === "employment_letter") {
      for (const n of s.notes) out.push({ docId: d.id, level: "check", message: n });
      if (!s.mentionsSignature) out.push({ docId: d.id, level: "check", message: "We couldn't see a signature block. IRCC expects reference letters to be signed by the employer, on letterhead with contact details." });
      const body = norm(d.meta.text ?? "");
      const job = (p.jobs ?? []).find((j) => (norm(j.employer) && body.includes(norm(j.employer))) || (s.jobTitle && norm(j.title) === norm(s.jobTitle)));
      if (job) {
        if (s.hoursPerWeek !== undefined && job.hoursPerWeek !== undefined && s.hoursPerWeek !== job.hoursPerWeek)
          out.push({ docId: d.id, level: "problem", message: `This letter says ${s.hoursPerWeek} hours a week; your profile says ${job.hoursPerWeek} for ${job.title ?? "this job"}.` });
        if (s.startDate && job.startDate && s.startDate !== job.startDate)
          out.push({ docId: d.id, level: "problem", message: `This letter gives a start date of ${s.startDate}; your profile says ${job.startDate}.` });
      }
    }

    if (d.docType === "eca" && s.ecaLevel && p.ecaEquivalent && s.ecaLevel !== p.ecaEquivalent) {
      out.push({ docId: d.id, level: "check", message: "The equivalency in this ECA seems different from the level in your profile. Check the wording on the report." });
    }

    if (d.meta.textStatus === "image" || d.meta.textStatus === "no_text") {
      out.push({ docId: d.id, level: "check", message: "We couldn't read text from this file (it's an image or a scan), so we couldn't check it. Add its dates by hand." });
    }
  }
  return out;
}
