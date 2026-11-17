/**
 * Language test score → Canadian Language Benchmark (CLB, English) or
 * Niveaux de compétence linguistique canadiens (NCLC, French).
 *
 * Source: IRCC, Express Entry "Language test results" page
 * https://www.canada.ca/en/immigration-refugees-citizenship/services/immigrate-canada/express-entry/documents/language-test.html
 * Page date 2026-10-16, verified 2026-11-17.
 *
 * A level of 0 means "below CLB/NCLC 4". Levels above 10 are reported as 10
 * because no Express Entry table distinguishes them.
 */

export type Ability = "reading" | "writing" | "listening" | "speaking";
export const ABILITIES: Ability[] = ["listening", "reading", "writing", "speaking"];

export type TestType = "ielts_gt" | "celpip_g" | "pte_core" | "tef_canada" | "tcf_canada";
export type OfficialLanguage = "english" | "french";

export type AbilityScores = Record<Ability, number>;
export type ClbLevels = Record<Ability, number>;

interface TestSpec {
  label: string;
  language: OfficialLanguage;
  /** [level, minimum score] from CLB 10 down to CLB 4. */
  thresholds: Record<Ability, Array<[number, number]>>;
  range: Record<Ability, [number, number]>;
  step: number;
  note?: string;
}

const ladder = (mins: number[]): Array<[number, number]> =>
  mins.map((min, i) => [10 - i, min] as [number, number]);

export const LANGUAGE_TABLE_VERSION = "2026-10-16";
export const LANGUAGE_TABLE_SOURCE =
  "https://www.canada.ca/en/immigration-refugees-citizenship/services/immigrate-canada/express-entry/documents/language-test.html";

export const TESTS: Record<TestType, TestSpec> = {
  ielts_gt: {
    label: "IELTS General Training",
    language: "english",
    thresholds: {
      listening: ladder([8.5, 8.0, 7.5, 6.0, 5.5, 5.0, 4.5]),
      reading: ladder([8.0, 7.0, 6.5, 6.0, 5.0, 4.0, 3.5]),
      writing: ladder([7.5, 7.0, 6.5, 6.0, 5.5, 5.0, 4.0]),
      speaking: ladder([7.5, 7.0, 6.5, 6.0, 5.5, 5.0, 4.0]),
    },
    range: { listening: [0, 9], reading: [0, 9], writing: [0, 9], speaking: [0, 9] },
    step: 0.5,
    note: "IELTS Academic and IELTS One Skill Retake are not accepted for Express Entry.",
  },
  celpip_g: {
    label: "CELPIP-General",
    language: "english",
    thresholds: {
      listening: ladder([10, 9, 8, 7, 6, 5, 4]),
      reading: ladder([10, 9, 8, 7, 6, 5, 4]),
      writing: ladder([10, 9, 8, 7, 6, 5, 4]),
      speaking: ladder([10, 9, 8, 7, 6, 5, 4]),
    },
    range: { listening: [0, 12], reading: [0, 12], writing: [0, 12], speaking: [0, 12] },
    step: 1,
    note: "CELPIP-General levels match CLB levels one to one.",
  },
  pte_core: {
    label: "PTE Core",
    language: "english",
    thresholds: {
      listening: ladder([89, 82, 71, 60, 50, 39, 28]),
      reading: ladder([88, 78, 69, 60, 51, 42, 33]),
      writing: ladder([90, 88, 79, 69, 60, 51, 41]),
      speaking: ladder([89, 84, 76, 68, 59, 51, 42]),
    },
    range: { listening: [10, 90], reading: [10, 90], writing: [10, 90], speaking: [10, 90] },
    step: 1,
    note: "Only PTE Core is accepted. PTE Academic is not.",
  },
  tef_canada: {
    label: "TEF Canada",
    language: "french",
    thresholds: {
      listening: ladder([316, 298, 280, 249, 217, 181, 145]),
      reading: ladder([263, 248, 233, 207, 181, 151, 121]),
      writing: ladder([393, 371, 349, 310, 271, 226, 181]),
      speaking: ladder([393, 371, 349, 310, 271, 226, 181]),
    },
    range: { listening: [0, 360], reading: [0, 300], writing: [0, 450], speaking: [0, 450] },
    step: 1,
    note: "Enter the scores from the \"Équivalence ancien score\" column of your TEF Canada result, as IRCC instructs.",
  },
  tcf_canada: {
    label: "TCF Canada",
    language: "french",
    thresholds: {
      listening: ladder([549, 523, 503, 458, 398, 369, 331]),
      reading: ladder([549, 524, 499, 453, 406, 375, 342]),
      writing: ladder([16, 14, 12, 10, 7, 6, 4]),
      speaking: ladder([16, 14, 12, 10, 7, 6, 4]),
    },
    range: { listening: [0, 699], reading: [0, 699], writing: [0, 20], speaking: [0, 20] },
    step: 1,
  },
};

export function scoreToClb(test: TestType, ability: Ability, score: number): number {
  const spec = TESTS[test];
  const [lo, hi] = spec.range[ability];
  if (!Number.isFinite(score) || score < lo || score > hi) {
    throw new RangeError(`${spec.label} ${ability} score ${score} is outside ${lo} to ${hi}`);
  }
  for (const [level, min] of spec.thresholds[ability]) {
    if (score >= min) return level;
  }
  return 0;
}

export function scoresToClb(test: TestType, scores: AbilityScores): ClbLevels {
  return {
    listening: scoreToClb(test, "listening", scores.listening),
    reading: scoreToClb(test, "reading", scores.reading),
    writing: scoreToClb(test, "writing", scores.writing),
    speaking: scoreToClb(test, "speaking", scores.speaking),
  };
}

export function minClb(levels: ClbLevels): number {
  return Math.min(levels.listening, levels.reading, levels.writing, levels.speaking);
}

/** Results must be less than 2 years old at profile creation and at PR application. */
export function testIsValid(testDate: string | Date, on: Date): boolean {
  const d = new Date(testDate);
  const expiry = new Date(d);
  expiry.setFullYear(expiry.getFullYear() + 2);
  return on < expiry;
}
