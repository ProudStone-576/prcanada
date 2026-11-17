/**
 * Express Entry program rules, each verified against the official IRCC page
 * named beside it on VERIFIED_AT. Edit only with a new verification.
 */

export const VERIFIED_AT = "2026-11-17";
const IRCC = "https://www.canada.ca/en/immigration-refugees-citizenship/services/immigrate-canada/express-entry";

export const SOURCES = {
  cec: `${IRCC}/eligibility/canadian-experience-class.html`,
  fsw: `${IRCC}/eligibility/federal-skilled-workers.html`,
  fst: `${IRCC}/eligibility/skilled-trades.html`,
  language: `${IRCC}/documents/language-test.html`,
  eca: `${IRCC}/documents/education-assessed.html`,
  funds: `${IRCC}/documents/proof-funds.html`,
  categories: `${IRCC}/rounds-invitations/category-based-selection.html`,
};

/** Language minimums (language-test page, page date 2026-10-16). */
export const LANGUAGE_MIN = {
  cecTeer01: 7,
  cecTeer23: 5,
  fswFirst: 7,
  fswSecondForPoints: 5,
  fstSpeakListen: 5,
  fstReadWrite: 4,
};

/** FSW selection grid (FSW page dated 2026-11-03; education table on the ECA page dated 2026-10-16). Pass mark 67 of 100. */
export const FSW = {
  passMark: 67,
  firstLanguagePerAbility: [
    { minClb: 9, points: 6 },
    { minClb: 8, points: 5 },
    { minClb: 7, points: 4 },
  ],
  secondLanguageAllFour: { minClb: 5, points: 4 },
  education: {
    less_than_secondary: 0,
    secondary: 5,
    one_year: 15,
    two_year: 19,
    bachelors_or_three_year: 21,
    two_or_more: 22,
    masters_or_professional: 23,
    doctoral: 25,
  } as Record<string, number>,
  experience: (years: number) => (years >= 6 ? 15 : years >= 4 ? 13 : years >= 2 ? 11 : years >= 1 ? 9 : 0),
  age: (age: number) => {
    if (age < 18) return 0;
    if (age <= 35) return 12;
    if (age >= 47) return 0;
    return 12 - (age - 35); // 36 → 11 ... 46 → 1
  },
  arrangedEmployment: 10,
  adaptability: { spouseLanguage: 5, ownStudy: 5, spouseStudy: 5, ownWork: 10, spouseWork: 5, arrangedEmployment: 5, relative: 5, cap: 10 },
};

/** FST eligible trades: Major Groups 72 (not 726), 73, 82, 83, 92, 93 (not 932), Minor Group 6320, Unit Group 62200. */
export function isFstTrade(noc: string): boolean {
  if (!/^\d{5}$/.test(noc)) return false;
  const major = noc.slice(0, 2);
  if (major === "72") return !noc.startsWith("726");
  if (major === "93") return !noc.startsWith("932");
  if (["73", "82", "83", "92"].includes(major)) return true;
  return noc.startsWith("6320") || noc === "62200";
}

/** Proof of funds, "Updated July 7, 2025" (page dated 2026-10-16). */
export const FUNDS = {
  updated: "2025-07-07",
  table: [15263, 19001, 23360, 28362, 32168, 36280, 40392],
  extraPerPerson: 4112,
};

export function fundsRequired(familySize: number): number {
  const n = Math.max(1, Math.floor(familySize));
  return n <= 7 ? FUNDS.table[n - 1] : FUNDS.table[6] + (n - 7) * FUNDS.extraPerPerson;
}

export interface Category {
  key: string;
  name: string;
  kind: "language" | "occupation" | "military";
  canadaOnly?: boolean;
  nocs?: string[];
}

/** Category-based selection, current categories (page dated 2026-10-16). Occupation categories need 12 months full-time (or equal part-time) in the past 3 years in one listed occupation. */
export const CATEGORIES: Category[] = [
  { key: "french", name: "French-language proficiency", kind: "language" },
  {
    key: "healthcare",
    name: "Healthcare and social services",
    kind: "occupation",
    nocs: ["31100", "31101", "31102", "31103", "31110", "31111", "31112", "31120", "31121", "31200", "31201", "31202", "31203", "31209", "31300", "31301", "31302", "31303", "32101", "32102", "32103", "32104", "32109", "32111", "32120", "32121", "32122", "32123", "32124", "32129", "32201", "33101", "33102", "33103", "41300", "41301", "42201"],
  },
  { key: "stem", name: "STEM", kind: "occupation", nocs: ["20011", "21220", "21300", "21301", "21310", "21321", "21331", "22300", "22301", "22310", "63100"] },
  {
    key: "trades",
    name: "Trades",
    kind: "occupation",
    nocs: ["22303", "70010", "70011", "72100", "72102", "72106", "72200", "72201", "72300", "72302", "72310", "72311", "72320", "72400", "72401", "72402", "72422", "72501", "72999", "73100", "73110", "73112", "73113", "82021", "63201"],
  },
  { key: "education", name: "Education", kind: "occupation", nocs: ["41220", "41221", "42202", "42203", "43100"] },
  { key: "transport", name: "Transport", kind: "occupation", nocs: ["72404", "72600", "22313", "72410"] },
  { key: "physicians", name: "Physicians with Canadian work experience", kind: "occupation", canadaOnly: true, nocs: ["31100", "31101", "31102"] },
  { key: "senior_managers", name: "Senior managers with Canadian work experience", kind: "occupation", canadaOnly: true, nocs: ["00012", "00013", "00014", "00015"] },
  { key: "researchers", name: "Researchers with Canadian work experience", kind: "occupation", canadaOnly: true, nocs: ["41200", "41201"] },
  { key: "military", name: "Skilled military recruits", kind: "military" },
];
