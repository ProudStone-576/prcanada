/**
 * CRS engine tests. Every expected total below is worked out by hand from the
 * official IRCC tables (crs-criteria page, page date 2026-11-03) and shown in
 * the comment above it, so a reviewer can check the arithmetic line by line.
 * These should also be cross-checked against IRCC's own CRS tool before launch.
 */
import { describe, expect, it } from "vitest";
import { calculateCrs } from "../lib/engine/crs/calculate";
import { CRS_2025_03_25, CRS_2026_11_03, ruleSetFor } from "../lib/engine/crs/rules";
import type { CrsInput } from "../lib/engine/crs/types";
import type { ClbLevels } from "../lib/engine/language";

const clb = (n: number): ClbLevels => ({ listening: n, reading: n, writing: n, speaking: n });

const base: CrsInput = {
  age: 29,
  accompanyingSpouse: false,
  education: "bachelors_or_three_year",
  english: clb(9),
  french: null,
  firstLanguage: "auto",
  canadianWorkYears: 1,
  foreignWorkYears: 0,
  highWageExperience: "none",
  jobOffer: "none",
  certificateOfQualification: false,
  canadianEducation: "none",
  siblingInCanada: false,
  provincialNomination: false,
  spouse: null,
};

const section = (r: ReturnType<typeof calculateCrs>, key: string) => r.sections.find((s) => s.key === key)!;
const line = (r: ReturnType<typeof calculateCrs>, key: string) => r.sections.flatMap((s) => s.lines).find((l) => l.key === key)!;

describe("CRS 2026-11-03", () => {
  it("single PGWP holder: age 29, bachelor's, CLB 9, one year Canadian work", () => {
    // Core: age 110 + education 120 + language 4 x 31 = 124 + LMI 40 = 394
    // Transferability: education+language 25, education+Canadian work 13 = 38
    // Total 432
    const r = calculateCrs(base, CRS_2026_11_03);
    expect(section(r, "core").points).toBe(394);
    expect(section(r, "transferability").points).toBe(38);
    expect(r.total).toBe(432);
  });

  it("applicant with spouse, job offer beats experience, all caps hit", () => {
    // Core: age 31 → 90; master's 126; English CLB 10 → 4 x 32 = 128;
    //   French NCLC 7 → 4 x 3 = 12; LMI: experience 56 + high-wage 40 = 96 vs offer 100 → 100. Core 456
    // Spouse: bachelor's 8; CLB 7 → 4 x 3 = 12; one year 5. Spouse 25
    // Transferability: education 50 + 50 capped 50; foreign 2 years 25 + 25 = 50; total 100
    // Additional: French bonus 50, Canadian 2-year credential 15, sibling 15 = 80
    // Total 661
    const input: CrsInput = {
      ...base,
      age: 31,
      accompanyingSpouse: true,
      education: "masters_or_professional",
      english: clb(10),
      french: clb(7),
      canadianWorkYears: 3,
      foreignWorkYears: 2,
      highWageExperience: "x1_5",
      jobOffer: "x2",
      canadianEducation: "one_or_two_year",
      siblingInCanada: true,
      spouse: { education: "bachelors_or_three_year", language: clb(7), canadianWorkYears: 1 },
    };
    const r = calculateCrs(input, CRS_2026_11_03);
    expect(line(r, "labour_market_integration").points).toBe(100);
    expect(section(r, "core").points).toBe(456);
    expect(section(r, "spouse").points).toBe(25);
    expect(section(r, "transferability").points).toBe(100);
    expect(section(r, "additional").points).toBe(80);
    expect(r.total).toBe(661);
    expect(r.firstLanguageUsed).toBe("english");
  });

  it("never gives both experience and job offer points", () => {
    // Single: 5 years (80) + high-wage x2 (70) = 150 vs offer x2 100 → 150, at the cap
    const r = calculateCrs({ ...base, canadianWorkYears: 6, highWageExperience: "x2", jobOffer: "x2" }, CRS_2026_11_03);
    expect(line(r, "labour_market_integration").points).toBe(150);
  });

  it("does not award high-wage experience without a year of Canadian work", () => {
    const r = calculateCrs({ ...base, canadianWorkYears: 0, highWageExperience: "x2" }, CRS_2026_11_03);
    expect(line(r, "labour_market_integration").points).toBe(0);
    expect(r.warnings.length).toBeGreaterThan(0);
  });

  it("caps the second official language at 22 with a spouse", () => {
    const r = calculateCrs(
      { ...base, accompanyingSpouse: true, french: clb(9), spouse: { education: "secondary", language: null, canadianWorkYears: 0 } },
      CRS_2026_11_03,
    );
    expect(line(r, "second_language").points).toBe(22);
  });

  it("caps additional points at 600 with a nomination", () => {
    const r = calculateCrs({ ...base, provincialNomination: true, siblingInCanada: true, canadianEducation: "three_year_or_more" }, CRS_2026_11_03);
    expect(section(r, "additional").points).toBe(600);
  });

  it("scores the trade certificate on the lowest first-language ability", () => {
    const r = calculateCrs({ ...base, english: { listening: 9, reading: 6, writing: 7, speaking: 7 }, certificateOfQualification: true }, CRS_2026_11_03);
    expect(line(r, "transfer_certificate").points).toBe(25);
  });

  it("treats a spouse who is not coming as no spouse", () => {
    const r = calculateCrs({ ...base, accompanyingSpouse: false, spouse: { education: "doctoral", language: clb(10), canadianWorkYears: 5 } }, CRS_2026_11_03);
    expect(r.sections.find((s) => s.key === "spouse")).toBeUndefined();
    expect(line(r, "age").points).toBe(110);
  });

  it("gives 25 French points when English is weak or absent", () => {
    const r = calculateCrs({ ...base, english: null, french: clb(7) }, CRS_2026_11_03);
    expect(r.firstLanguageUsed).toBe("french");
    expect(line(r, "french").points).toBe(25);
  });

  it("age 45 and over scores zero", () => {
    expect(line(calculateCrs({ ...base, age: 47 }, CRS_2026_11_03), "age").points).toBe(0);
  });

  it("is deterministic", () => {
    expect(calculateCrs(base, CRS_2026_11_03)).toEqual(calculateCrs(base, CRS_2026_11_03));
  });
});

describe("CRS 2025-03-25 (archived)", () => {
  it("scores Canadian work on length only and ignores job offers", () => {
    // Same as the spouse case above with work length 56 in place of LMI 100: core 412, total 617
    const input: CrsInput = {
      ...base,
      age: 31,
      accompanyingSpouse: true,
      education: "masters_or_professional",
      english: clb(10),
      french: clb(7),
      canadianWorkYears: 3,
      foreignWorkYears: 2,
      highWageExperience: "x1_5",
      jobOffer: "x2",
      canadianEducation: "one_or_two_year",
      siblingInCanada: true,
      spouse: { education: "bachelors_or_three_year", language: clb(7), canadianWorkYears: 1 },
    };
    const r = calculateCrs(input, CRS_2025_03_25);
    expect(line(r, "canadian_work").points).toBe(56);
    expect(r.total).toBe(617);
  });
});

describe("rule set selection", () => {
  it("switches on the effective date", () => {
    expect(ruleSetFor(new Date("2026-11-02T12:00:00Z")).version).toBe("2025-03-25");
    expect(ruleSetFor(new Date("2026-11-03T12:00:00Z")).version).toBe("2026-11-03");
  });
  it("refuses dates no rule set covers", () => {
    expect(() => ruleSetFor(new Date("2024-01-01"))).toThrow();
  });
});
