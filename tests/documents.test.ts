import { describe, expect, it } from "vitest";
import { dateAfter, extractFields, findDates } from "../lib/documents/extract";
import { checkDocuments, expiryOf, type StoredDoc } from "../lib/documents/checks";
import { checklistFor } from "../lib/documents/checklist";
import { sniffMime } from "../lib/documents/types";
import type { Profile } from "../lib/profile/schema";

const on = new Date("2026-11-17T00:00:00Z");
const doc = (docType: StoredDoc["docType"], text: string, confirmed = {}): StoredDoc => ({
  id: Math.random().toString(36).slice(2),
  docType,
  createdAt: "2026-11-17",
  meta: { filename: "x.pdf", text, textStatus: "extracted", suggested: extractFields(docType, text), confirmed },
});

describe("dates", () => {
  it("reads unambiguous formats and skips ambiguous ones", () => {
    expect(findDates("2027-03-01, 1 March 2027, March 1, 2027, 2027 MAR 01")).toEqual(["2027-03-01", "2027-03-01", "2027-03-01", "2027-03-01"]);
    expect(findDates("03/04/2027")).toEqual([]);
    expect(findDates("2027-02-30")).toEqual([]);
  });
  it("finds the date after a label", () => {
    expect(dateAfter("Date issued: 2025-03-01  Expiry date: 2028-03-01", /expiry date/i)).toBe("2028-03-01");
  });
});

describe("file type sniffing", () => {
  it("trusts bytes, not names", () => {
    expect(sniffMime(new TextEncoder().encode("%PDF-1.4"))).toBe("application/pdf");
    expect(sniffMime(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0, 0, 0, 0]))).toBe("image/png");
    expect(sniffMime(new Uint8Array([0xff, 0xd8, 0xff, 0xe0]))).toBe("image/jpeg");
    expect(sniffMime(new TextEncoder().encode("MZ executable"))).toBeNull();
  });
});

describe("extraction", () => {
  it("reads permit dates", () => {
    const f = extractFields("work_permit", "WORK PERMIT\nDate Issued: 2024-03-02\nExpiry Date: 2027-03-01\nEmployer: Northern Lights Software Inc.");
    expect(f.expiresOn).toBe("2027-03-01");
    expect(f.issuedOn).toBe("2024-03-02");
    expect(f.employer).toMatch(/Northern Lights/);
  });
  it("reads IELTS scores and warns about Academic", () => {
    const f = extractFields("language_test", "IELTS Academic Test Report Form\nTest Date 10 January 2026\nListening 8.0 Reading 7.0 Writing 7.0 Speaking 7.5");
    expect(f.scores).toEqual({ listening: 8, reading: 7, writing: 7, speaking: 7.5 });
    expect(f.testDate).toBe("2026-01-10");
    expect(f.notes.join(" ")).toMatch(/Academic/);
  });
  it("checks reference letters for what IRCC asks", () => {
    const f = extractFields("employment_letter", "To whom it may concern, Asha has worked in the position of Software Developer since 1 September 2024, 40 hours per week, at $85,000 per year. Her duties include writing code. Sincerely,");
    expect(f.hoursPerWeek).toBe(40);
    expect(f.salary).toMatch(/85,000/);
    expect(f.startDate).toBe("2024-09-01");
    expect(f.hasDuties).toBe(true);
    expect(f.notes).toEqual([]);
  });
});

describe("checks", () => {
  const p: Profile = {
    permitExpiryDate: "2027-03-01",
    englishTest: { type: "ielts_gt", date: "2026-01-10", listening: 8, reading: 7, writing: 7, speaking: 7 },
    jobs: [{ id: "j1", country: "canada", title: "Software Developer", employer: "Northern Lights", startDate: "2024-09-01", hoursPerWeek: 37.5 }],
  };
  it("flags expired and mismatched documents", () => {
    const f = checkDocuments([doc("passport", "Date of expiry 2026-05-01"), doc("work_permit", "Expiry Date: 2027-06-01")], p, on);
    expect(f.some((x) => x.level === "problem" && /expired/.test(x.message))).toBe(true);
    expect(f.some((x) => /your profile says 2027-03-01/.test(x.message))).toBe(true);
  });
  it("flags score and hours differences", () => {
    const f = checkDocuments([
      doc("language_test", "IELTS General Training\nTest Date 2026-01-10\nListening 8.0 Reading 6.5 Writing 7.0 Speaking 7.0"),
      doc("employment_letter", "Northern Lights. Position of Software Developer since 2024-09-01, 40 hours per week, $40 per hour. Duties: coding. Sincerely"),
    ], p, on);
    expect(f.some((x) => /reading/.test(x.message))).toBe(true);
    expect(f.some((x) => /40 hours a week/.test(x.message))).toBe(true);
  });
  it("language results expire 2 years after the test", () => {
    expect(expiryOf(doc("language_test", "Test Date 2026-01-10"))).toBe("2028-01-10");
  });
});

describe("checklists", () => {
  it("builds items from the person's situation", () => {
    const p: Profile = { status: "pgwp", educationEarnedIn: "foreign", jobs: [{ id: "j1", country: "canada", title: "Dev" }] };
    const c = checklistFor("fsw", p, [doc("passport", "Date of expiry 2030-01-01")], on);
    const keys = c.items.map((i) => i.key);
    expect(keys).toEqual(expect.arrayContaining(["passport", "language", "eca", "letter-j1", "permit", "funds"]));
    expect(c.items.find((i) => i.key === "passport")!.state).toBe("have");
    expect(checklistFor("cec", p, [], on).items.some((i) => i.key === "funds")).toBe(false);
  });
});
