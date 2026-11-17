import type { ClbLevels, OfficialLanguage } from "../language";

export type EducationLevel =
  | "less_than_secondary"
  | "secondary"
  | "one_year"
  | "two_year"
  | "bachelors_or_three_year"
  | "two_or_more"
  | "masters_or_professional"
  | "doctoral";

export const EDUCATION_LABELS: Record<EducationLevel, string> = {
  less_than_secondary: "Less than secondary school (high school)",
  secondary: "Secondary diploma (high school graduation)",
  one_year: "One-year post-secondary program",
  two_year: "Two-year post-secondary program",
  bachelors_or_three_year: "Bachelor's degree, or a program of three or more years",
  two_or_more: "Two or more credentials, at least one of them three or more years",
  masters_or_professional: "Master's degree, or a professional degree needed to practise a licensed profession",
  doctoral: "Doctoral degree (PhD)",
};

export type CanadianEducation = "none" | "one_or_two_year" | "three_year_or_more";

/** IRCC high-wage occupation level: median wage at least 1.3x, 1.5x or 2x the average median wage. */
export type HighWageLevel = "none" | "x1_3" | "x1_5" | "x2";

export const HIGH_WAGE_LABELS: Record<HighWageLevel, string> = {
  none: "Not on IRCC's high-wage list, or I don't know",
  x1_3: "Listed at 1.3 times the average median wage",
  x1_5: "Listed at 1.5 times the average median wage",
  x2: "Listed at 2 times the average median wage",
};

export interface SpouseInput {
  education: EducationLevel;
  /** Spouse's first official language results as CLB/NCLC levels, or null if no test. */
  language: ClbLevels | null;
  canadianWorkYears: number;
}

/**
 * Normalized, test-agnostic input to the CRS calculation.
 * Work experience is counted in full years of skilled (TEER 0, 1, 2 or 3) paid work.
 */
export interface CrsInput {
  age: number;
  /** True only if the spouse or common-law partner is coming to Canada and is not a Canadian citizen or PR. */
  accompanyingSpouse: boolean;
  education: EducationLevel;
  english: ClbLevels | null;
  french: ClbLevels | null;
  /** Which official language the applicant declares first. "auto" picks the one worth more points. */
  firstLanguage: OfficialLanguage | "auto";
  canadianWorkYears: number;
  foreignWorkYears: number;
  /** Level on IRCC's high-wage list for at least 12 months of the Canadian work experience. */
  highWageExperience: HighWageLevel;
  /** Level on IRCC's high-wage list for a qualifying job offer. */
  jobOffer: HighWageLevel;
  certificateOfQualification: boolean;
  canadianEducation: CanadianEducation;
  siblingInCanada: boolean;
  provincialNomination: boolean;
  spouse: SpouseInput | null;
}

export interface FactorLine {
  key: string;
  label: string;
  points: number;
  max: number;
  explanation: string;
}

export interface CrsSection {
  key: "core" | "spouse" | "transferability" | "additional";
  label: string;
  points: number;
  max: number;
  lines: FactorLine[];
}

export interface CrsResult {
  ruleSetVersion: string;
  ruleSetSource: string;
  total: number;
  sections: CrsSection[];
  firstLanguageUsed: OfficialLanguage | null;
  warnings: string[];
}
