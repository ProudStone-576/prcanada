/**
 * The calculator's form state (raw test scores, plain numbers) and its
 * conversion to engine input. Pure, so the browser and the server compute the
 * same thing; the server always recomputes before saving.
 */
import { z } from "zod";
import { ABILITIES, scoresToClb, TESTS, type TestType } from "../language";
import type { CrsInput } from "./types";

const test = z.object({
  type: z.enum(["ielts_gt", "celpip_g", "pte_core", "tef_canada", "tcf_canada"]),
  listening: z.number(),
  reading: z.number(),
  writing: z.number(),
  speaking: z.number(),
});
export type CalcTest = z.infer<typeof test>;

const edu = z.enum(["less_than_secondary", "secondary", "one_year", "two_year", "bachelors_or_three_year", "two_or_more", "masters_or_professional", "doctoral"]);
const wage = z.enum(["none", "x1_3", "x1_5", "x2"]);

export const calcStateSchema = z.object({
  age: z.number().int().min(16).max(80),
  spouse: z.boolean(),
  education: edu,
  english: test.nullable(),
  french: test.nullable(),
  canadianWorkYears: z.number().int().min(0).max(10),
  foreignWorkYears: z.number().int().min(0).max(10),
  highWageExperience: wage,
  jobOffer: wage,
  certificateOfQualification: z.boolean(),
  canadianEducation: z.enum(["none", "one_or_two_year", "three_year_or_more"]),
  siblingInCanada: z.boolean(),
  provincialNomination: z.boolean(),
  spouseEducation: edu,
  spouseTest: test.nullable(),
  spouseCanadianWorkYears: z.number().int().min(0).max(10),
});
export type CalcState = z.infer<typeof calcStateSchema>;

export const DEFAULT_STATE: CalcState = {
  age: 27,
  spouse: false,
  education: "bachelors_or_three_year",
  english: { type: "ielts_gt", listening: 7, reading: 6.5, writing: 6.5, speaking: 6.5 },
  french: null,
  canadianWorkYears: 1,
  foreignWorkYears: 0,
  highWageExperience: "none",
  jobOffer: "none",
  certificateOfQualification: false,
  canadianEducation: "one_or_two_year",
  siblingInCanada: false,
  provincialNomination: false,
  spouseEducation: "bachelors_or_three_year",
  spouseTest: null,
  spouseCanadianWorkYears: 0,
};

export function toCrsInput(s: CalcState): { input: CrsInput | null; error: string | null } {
  try {
    const conv = (t: CalcTest | null) => (t ? scoresToClb(t.type, t) : null);
    const english = conv(s.english);
    const french = conv(s.french);
    if (s.english && TESTS[s.english.type].language !== "english") throw new Error("The English test must be IELTS, CELPIP or PTE Core");
    if (s.french && TESTS[s.french.type].language !== "french") throw new Error("The French test must be TEF Canada or TCF Canada");
    return {
      error: null,
      input: {
        age: s.age,
        accompanyingSpouse: s.spouse,
        education: s.education,
        english,
        french,
        firstLanguage: "auto",
        canadianWorkYears: s.canadianWorkYears,
        foreignWorkYears: s.foreignWorkYears,
        highWageExperience: s.highWageExperience,
        jobOffer: s.jobOffer,
        certificateOfQualification: s.certificateOfQualification,
        canadianEducation: s.canadianEducation,
        siblingInCanada: s.siblingInCanada,
        provincialNomination: s.provincialNomination,
        spouse: s.spouse ? { education: s.spouseEducation, language: conv(s.spouseTest), canadianWorkYears: s.spouseCanadianWorkYears } : null,
      },
    };
  } catch (e) {
    return { input: null, error: (e as Error).message };
  }
}

/** The lowest scores on a given test that reach a level in all four abilities. */
export function scoresForLevel(type: TestType, level: number): CalcTest {
  const out = { type } as CalcTest;
  for (const a of ABILITIES) {
    const row = TESTS[type].thresholds[a].find(([l]) => l === level);
    out[a] = row ? row[1] : TESTS[type].thresholds[a][0][1];
  }
  return out;
}

export interface WhatIf {
  key: string;
  label: string;
  apply: (s: CalcState) => CalcState | null;
}

/** Each returns null when it would not change anything for this person. */
export const WHAT_IFS: WhatIf[] = [
  {
    key: "cwe",
    label: "One more year of Canadian work",
    apply: (s) => (s.canadianWorkYears >= 5 ? null : { ...s, canadianWorkYears: s.canadianWorkYears + 1 }),
  },
  {
    key: "en9",
    label: "CLB 9 in every English ability",
    apply: (s) => ({ ...s, english: scoresForLevel(s.english?.type ?? "ielts_gt", 9) }),
  },
  {
    key: "en10",
    label: "CLB 10 in every English ability",
    apply: (s) => ({ ...s, english: scoresForLevel(s.english?.type ?? "ielts_gt", 10) }),
  },
  {
    key: "fr7",
    label: "NCLC 7 in French",
    apply: (s) => (s.french ? null : { ...s, french: scoresForLevel("tef_canada", 7) }),
  },
  {
    key: "pnp",
    label: "A provincial nomination",
    apply: (s) => (s.provincialNomination ? null : { ...s, provincialNomination: true }),
  },
];
