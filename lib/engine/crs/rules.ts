/**
 * Versioned CRS point tables. A rule set is never edited after release:
 * a new IRCC change is a new rule set with its own effective date and tests.
 */

export interface CrsRuleSet {
  version: string;
  effectiveFrom: string; // ISO date, inclusive
  effectiveTo: string | null; // ISO date, exclusive
  sourceUrl: string;
  verifiedAt: string;
  summary: string;
  /** Points by age, index = age 17..45; [withSpouse, single]. */
  age: Record<number, [number, number]>;
  education: Record<string, [number, number]>;
  firstLanguage: Array<{ minClb: number; points: [number, number] }>;
  firstLanguageCap: [number, number];
  secondLanguage: Array<{ minClb: number; points: number }>;
  secondLanguageCap: [number, number];
  canadianWork: Record<number, [number, number]>; // years 0..5
  /** Labour Market Integration factor (from 2026-11-03). null = not part of this rule set. */
  labourMarketIntegration: null | {
    highWageExperience: Record<string, number>;
    jobOffer: Record<string, number>;
    cap: [number, number];
  };
  spouse: {
    education: Record<string, number>;
    language: Array<{ minClb: number; points: number }>;
    canadianWork: Record<number, number>;
  };
  transferability: {
    groupCap: number;
    totalCap: number;
  };
  additional: {
    sibling: number;
    frenchWithWeakOrNoEnglish: number;
    frenchWithEnglish: number;
    canadianEducationShort: number;
    canadianEducationLong: number;
    provincialNomination: number;
    total: number;
  };
}

const CRS_CRITERIA_URL =
  "https://www.canada.ca/en/immigration-refugees-citizenship/services/immigrate-canada/express-entry/check-score/crs-criteria.html";

const age: CrsRuleSet["age"] = {
  17: [0, 0], 18: [90, 99], 19: [95, 105], 20: [100, 110], 21: [100, 110], 22: [100, 110],
  23: [100, 110], 24: [100, 110], 25: [100, 110], 26: [100, 110], 27: [100, 110],
  28: [100, 110], 29: [100, 110], 30: [95, 105], 31: [90, 99], 32: [85, 94], 33: [80, 88],
  34: [75, 83], 35: [70, 77], 36: [65, 72], 37: [60, 66], 38: [55, 61], 39: [50, 55],
  40: [45, 50], 41: [35, 39], 42: [25, 28], 43: [15, 17], 44: [5, 6], 45: [0, 0],
};

const education: CrsRuleSet["education"] = {
  less_than_secondary: [0, 0],
  secondary: [28, 30],
  one_year: [84, 90],
  two_year: [91, 98],
  bachelors_or_three_year: [112, 120],
  two_or_more: [119, 128],
  masters_or_professional: [126, 135],
  doctoral: [140, 150],
};

const firstLanguage: CrsRuleSet["firstLanguage"] = [
  { minClb: 10, points: [32, 34] },
  { minClb: 9, points: [29, 31] },
  { minClb: 8, points: [22, 23] },
  { minClb: 7, points: [16, 17] },
  { minClb: 6, points: [8, 9] },
  { minClb: 4, points: [6, 6] },
  { minClb: 0, points: [0, 0] },
];

const secondLanguage: CrsRuleSet["secondLanguage"] = [
  { minClb: 9, points: 6 },
  { minClb: 7, points: 3 },
  { minClb: 5, points: 1 },
  { minClb: 0, points: 0 },
];

const canadianWork: CrsRuleSet["canadianWork"] = {
  0: [0, 0], 1: [35, 40], 2: [46, 53], 3: [56, 64], 4: [63, 72], 5: [70, 80],
};

const spouse: CrsRuleSet["spouse"] = {
  education: {
    less_than_secondary: 0, secondary: 2, one_year: 6, two_year: 7,
    bachelors_or_three_year: 8, two_or_more: 9, masters_or_professional: 10, doctoral: 10,
  },
  language: [
    { minClb: 9, points: 5 },
    { minClb: 7, points: 3 },
    { minClb: 5, points: 1 },
    { minClb: 0, points: 0 },
  ],
  canadianWork: { 0: 0, 1: 5, 2: 7, 3: 8, 4: 9, 5: 10 },
};

const shared = {
  age, education, firstLanguage, secondLanguage, canadianWork, spouse,
  firstLanguageCap: [128, 136] as [number, number],
  secondLanguageCap: [22, 24] as [number, number],
  transferability: { groupCap: 50, totalCap: 100 },
};

/** March 25, 2025 to November 2, 2026: arranged employment points removed. */
export const CRS_2025_03_25: CrsRuleSet = {
  ...shared,
  version: "2025-03-25",
  effectiveFrom: "2025-03-25",
  effectiveTo: "2026-11-03",
  sourceUrl: CRS_CRITERIA_URL,
  verifiedAt: "2026-11-17",
  summary:
    "Job offer (arranged employment) points removed. Canadian work experience scored on length only.",
  labourMarketIntegration: null,
  additional: {
    sibling: 15,
    frenchWithWeakOrNoEnglish: 25,
    frenchWithEnglish: 50,
    canadianEducationShort: 15,
    canadianEducationLong: 30,
    provincialNomination: 600,
    total: 600,
  },
};

/** From November 3, 2026: Labour Market Integration factor. */
export const CRS_2026_11_03: CrsRuleSet = {
  ...shared,
  version: "2026-11-03",
  effectiveFrom: "2026-11-03",
  effectiveTo: null,
  sourceUrl: CRS_CRITERIA_URL,
  verifiedAt: "2026-11-17",
  summary:
    "New Labour Market Integration factor: the higher of Canadian work experience points (length plus high-wage occupation points) or a high-wage job offer. No LMIA needed for job offers.",
  labourMarketIntegration: {
    highWageExperience: { none: 0, x1_3: 20, x1_5: 40, x2: 70 },
    jobOffer: { none: 0, x1_3: 50, x1_5: 70, x2: 100 },
    cap: [140, 150],
  },
  additional: CRS_2025_03_25.additional,
};

export const CRS_RULE_SETS: CrsRuleSet[] = [CRS_2026_11_03, CRS_2025_03_25];

export function ruleSetFor(date: Date): CrsRuleSet {
  const iso = date.toISOString().slice(0, 10);
  const match = CRS_RULE_SETS.find(
    (r) => r.effectiveFrom <= iso && (r.effectiveTo === null || iso < r.effectiveTo),
  );
  if (!match) throw new Error(`No CRS rule set covers ${iso}`);
  return match;
}

export function ruleSetByVersion(version: string): CrsRuleSet {
  const match = CRS_RULE_SETS.find((r) => r.version === version);
  if (!match) throw new Error(`Unknown CRS rule set ${version}`);
  return match;
}
