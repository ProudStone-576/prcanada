/**
 * Document checklists for pathways the person is pursuing. Pure. Items are
 * built from the person's own situation (one reference letter per job, an ECA
 * only for foreign education, funds only when not exempt).
 */
import type { Profile } from "../profile/schema";
import { expiryOf, type StoredDoc } from "./checks";
import type { DocType } from "./types";

export interface ChecklistItem {
  key: string;
  label: string;
  docType: DocType;
  why: string;
  state: "have" | "expired" | "missing";
  docIds: string[];
}

export interface Checklist {
  pathway: string;
  items: ChecklistItem[];
  complete: number;
}

const AUTHORIZED = new Set(["pgwp", "closed_work_permit", "open_work_permit"]);

function item(docs: StoredDoc[], on: Date, key: string, label: string, docType: DocType, why: string, match?: (d: StoredDoc) => boolean): ChecklistItem {
  const found = docs.filter((d) => d.docType === docType && (!match || match(d)));
  const valid = found.filter((d) => {
    const e = expiryOf(d);
    return !e || e >= on.toISOString().slice(0, 10);
  });
  return { key, label, docType, why, state: valid.length ? "have" : found.length ? "expired" : "missing", docIds: found.map((d) => d.id) };
}

const norm = (s?: string) => (s ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");

function common(p: Profile, docs: StoredDoc[], on: Date, opts: { funds: boolean }): ChecklistItem[] {
  const items: ChecklistItem[] = [
    item(docs, on, "passport", "Passport", "passport", "Identity and travel document for you and each family member."),
    item(docs, on, "language", "Language test results", "language_test", "Must be under 2 years old when you create your profile and when you apply."),
  ];
  if (p.educationEarnedIn === "foreign" || p.educationEarnedIn === "both") {
    items.push(item(docs, on, "eca", "Educational Credential Assessment", "eca", "Foreign education needs an ECA, under 5 years old when you apply."));
  }
  if (p.educationEarnedIn === "canada" || p.educationEarnedIn === "both") {
    items.push(item(docs, on, "diploma", "Canadian diploma or degree", "diploma", "Proof of the credential you're claiming points for."));
    items.push(item(docs, on, "transcript", "Transcripts", "transcript", "Show the program length and full-time study."));
  }
  (p.jobs ?? []).forEach((j, i) => {
    const name = j.title || j.employer || `job ${i + 1}`;
    items.push(
      item(docs, on, `letter-${j.id}`, `Reference letter: ${name}`, "employment_letter", "On letterhead, signed, with your title, duties, dates, hours a week and salary.", (d) =>
        Boolean((j.employer && norm(d.meta.suggested.employer).includes(norm(j.employer))) || (j.title && norm(d.meta.suggested.jobTitle) === norm(j.title)) || (p.jobs ?? []).length === 1),
      ),
    );
  });
  if ((p.jobs ?? []).some((j) => j.country === "canada")) {
    items.push(item(docs, on, "t4", "T4 slips or Notices of Assessment", "t4", "Support your Canadian work history.", (d) => d.docType === "t4"));
  }
  if (p.status === "pgwp" || p.status === "closed_work_permit" || p.status === "open_work_permit") items.push(item(docs, on, "permit", "Current work permit", "work_permit", "Shows you were authorized to work."));
  if (p.status === "student") items.push(item(docs, on, "study", "Current study permit", "study_permit", "Shows your current status."));
  if (p.provincialNomination === "yes") items.push(item(docs, on, "pnp", "Provincial nomination certificate", "nomination_certificate", "Needed for the 600 CRS points and your application."));
  if (opts.funds) items.push(item(docs, on, "funds", "Bank letters for proof of funds", "bank_letter", "Official letters with balances and 6-month averages, unless you're exempt."));
  return items;
}

export function checklistFor(pathway: string, p: Profile, docs: StoredDoc[], on: Date): Checklist {
  const exempt = AUTHORIZED.has(p.status ?? "") && p.jobOfferValid === "yes";
  const needsFunds = pathway === "cec" ? false : pathway === "fsw" || pathway === "fst" ? !exempt : !AUTHORIZED.has(p.status ?? "");
  const items = common(p, docs, on, { funds: needsFunds });
  return { pathway, items, complete: items.filter((i) => i.state === "have").length };
}
