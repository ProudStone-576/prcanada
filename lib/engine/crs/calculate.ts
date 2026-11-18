import { ABILITIES, minClb, type ClbLevels, type OfficialLanguage } from "../language";
import type { CrsRuleSet } from "./rules";
import {
  EDUCATION_LABELS,
  type CrsInput,
  type CrsResult,
  type CrsSection,
  type EducationLevel,
  type FactorLine,
} from "./types";

const ABILITY_LABEL = { listening: "Listening", reading: "Reading", writing: "Writing", speaking: "Speaking" };

const yearsKey = (years: number, max = 5) => Math.max(0, Math.min(max, Math.floor(years)));
const sum = (lines: FactorLine[]) => lines.reduce((t, l) => t + l.points, 0);
const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

function clbLabel(level: number, lang: OfficialLanguage) {
  const name = lang === "french" ? "NCLC" : "CLB";
  return level === 0 ? `below ${name} 4` : `${name} ${level}`;
}

function firstLanguagePoints(rules: CrsRuleSet, levels: ClbLevels, col: number) {
  return ABILITIES.map((a) => {
    const row = rules.firstLanguage.find((r) => levels[a] >= r.minClb)!;
    return { ability: a, points: row.points[col], level: levels[a] };
  });
}

function secondLanguagePoints(rules: CrsRuleSet, levels: ClbLevels) {
  return ABILITIES.map((a) => {
    const row = rules.secondLanguage.find((r) => levels[a] >= r.minClb)!;
    return { ability: a, points: row.points, level: levels[a] };
  });
}

type CredentialGroup = "none" | "post_secondary" | "advanced";

/** Skill transferability groups the education levels into three bands. */
function credentialGroup(level: EducationLevel): CredentialGroup {
  if (level === "less_than_secondary" || level === "secondary") return "none";
  if (level === "one_year" || level === "two_year" || level === "bachelors_or_three_year") return "post_secondary";
  return "advanced";
}

/** 0 = no transferability, 1 = CLB 7+ on all four with one under 9, 2 = CLB 9+ on all four. */
function languageBand(levels: ClbLevels | null): 0 | 1 | 2 {
  if (!levels) return 0;
  const m = minClb(levels);
  if (m >= 9) return 2;
  if (m >= 7) return 1;
  return 0;
}

export function calculateCrs(input: CrsInput, rules: CrsRuleSet): CrsResult {
  const warnings: string[] = [];
  const withSpouse = input.accompanyingSpouse && input.spouse !== null;
  const col = withSpouse ? 0 : 1;
  const status = withSpouse ? "with an accompanying spouse or partner" : "without an accompanying spouse or partner";

  if (input.accompanyingSpouse && !input.spouse) {
    warnings.push("You said your spouse or partner is coming with you, but we have no details about them, so they were scored as not accompanying.");
  }

  // ── Which official language is first ───────────────────────────────
  let first: OfficialLanguage | null = null;
  if (input.firstLanguage !== "auto") {
    first = input[input.firstLanguage] ? input.firstLanguage : null;
    if (!first) warnings.push(`You chose ${input.firstLanguage} as your first official language but entered no ${input.firstLanguage} test results.`);
  } else if (input.english || input.french) {
    const total = (l: ClbLevels | null) => (l ? sum(firstLanguagePoints(rules, l, col).map((p) => ({ points: p.points } as FactorLine))) : -1);
    first = total(input.french) > total(input.english) ? "french" : "english";
  }
  const second: OfficialLanguage | null = first ? (first === "english" ? "french" : "english") : null;
  const firstLevels = first ? input[first] : null;
  const secondLevels = second ? input[second] : null;

  // ── A. Core / human capital ────────────────────────────────────────
  const core: FactorLine[] = [];

  const ageKey = Math.max(17, Math.min(45, Math.floor(input.age)));
  core.push({
    key: "age",
    label: "Age",
    points: rules.age[ageKey][col],
    max: withSpouse ? 100 : 110,
    explanation: `Age ${input.age}, ${status}. Highest points are for ages 20 to 29; points drop each year after 29 and reach 0 at 45.`,
  });

  core.push({
    key: "education",
    label: "Level of education",
    points: rules.education[input.education][col],
    max: withSpouse ? 140 : 150,
    explanation: `${EDUCATION_LABELS[input.education]}. Foreign credentials count only with an Educational Credential Assessment (ECA) from a designated organization.`,
  });

  if (firstLevels && first) {
    const parts = firstLanguagePoints(rules, firstLevels, col);
    const raw = parts.reduce((t, p) => t + p.points, 0);
    const pts = Math.min(raw, rules.firstLanguageCap[col]);
    core.push({
      key: "first_language",
      label: `First official language (${first === "english" ? "English" : "French"})`,
      points: pts,
      max: rules.firstLanguageCap[col],
      explanation: parts.map((p) => `${ABILITY_LABEL[p.ability]} ${clbLabel(p.level, first!)}: ${p.points}`).join("; ") + ".",
    });
  } else {
    core.push({
      key: "first_language",
      label: "First official language",
      points: 0,
      max: rules.firstLanguageCap[col],
      explanation: "No language test results entered. Express Entry requires an approved English or French test.",
    });
  }

  if (secondLevels && second) {
    const parts = secondLanguagePoints(rules, secondLevels);
    const raw = parts.reduce((t, p) => t + p.points, 0);
    const pts = Math.min(raw, rules.secondLanguageCap[col]);
    core.push({
      key: "second_language",
      label: `Second official language (${second === "english" ? "English" : "French"})`,
      points: pts,
      max: rules.secondLanguageCap[col],
      explanation:
        parts.map((p) => `${ABILITY_LABEL[p.ability]} ${clbLabel(p.level, second!)}: ${p.points}`).join("; ") +
        (raw > pts ? `. Capped at ${pts} ${status}.` : "."),
    });
  } else {
    core.push({
      key: "second_language",
      label: "Second official language",
      points: 0,
      max: rules.secondLanguageCap[col],
      explanation: "No results in a second official language.",
    });
  }

  const cweYears = yearsKey(input.canadianWorkYears);
  const cwePoints = rules.canadianWork[cweYears][col];
  const cweExplain = `${plural(cweYears, "year")}${cweYears === 5 ? " or more" : ""} of skilled Canadian work (TEER 0, 1, 2 or 3) in the last 10 years: ${cwePoints}`;

  if (rules.labourMarketIntegration) {
    const lmi = rules.labourMarketIntegration;
    let highWage = lmi.highWageExperience[input.highWageExperience];
    if (highWage > 0 && cweYears < 1) {
      highWage = 0;
      warnings.push("High-wage experience points need at least 12 months of Canadian work in a high-wage occupation. You entered less than one year of Canadian work, so they were not counted.");
    }
    const experienceRoute = cwePoints + highWage;
    const offerRoute = lmi.jobOffer[input.jobOffer];
    const pts = Math.min(Math.max(experienceRoute, offerRoute), lmi.cap[col]);
    const chose = offerRoute > experienceRoute ? "job offer" : "Canadian work experience";
    core.push({
      key: "labour_market_integration",
      label: "Labour market integration (Canadian work or job offer)",
      points: pts,
      max: lmi.cap[col],
      explanation:
        `Canadian work route: ${cweExplain}, plus ${highWage} for high-wage occupation experience = ${experienceRoute}. ` +
        `Job offer route: ${offerRoute}. ` +
        `IRCC gives the higher of the two, never both, so this uses the ${chose} route.`,
    });
  } else {
    core.push({
      key: "canadian_work",
      label: "Canadian work experience",
      points: cwePoints,
      max: withSpouse ? 70 : 80,
      explanation: `${cweExplain}.`,
    });
  }

  // ── B. Spouse factors ──────────────────────────────────────────────
  const spouseLines: FactorLine[] = [];
  if (withSpouse && input.spouse) {
    const s = input.spouse;
    spouseLines.push({
      key: "spouse_education",
      label: "Spouse's education",
      points: rules.spouse.education[s.education],
      max: 10,
      explanation: EDUCATION_LABELS[s.education] + ".",
    });
    if (s.language) {
      const parts = ABILITIES.map((a) => ({
        a,
        level: s.language![a],
        points: rules.spouse.language.find((r) => s.language![a] >= r.minClb)!.points,
      }));
      spouseLines.push({
        key: "spouse_language",
        label: "Spouse's first official language",
        points: Math.min(20, parts.reduce((t, p) => t + p.points, 0)),
        max: 20,
        explanation: parts.map((p) => `${ABILITY_LABEL[p.a]} CLB ${p.level || "below 4"}: ${p.points}`).join("; ") + ".",
      });
    } else {
      spouseLines.push({ key: "spouse_language", label: "Spouse's first official language", points: 0, max: 20, explanation: "No test results entered for your spouse or partner." });
    }
    const sy = yearsKey(s.canadianWorkYears);
    spouseLines.push({
      key: "spouse_canadian_work",
      label: "Spouse's Canadian work experience",
      points: rules.spouse.canadianWork[sy],
      max: 10,
      explanation: `${plural(sy, "year")}${sy === 5 ? " or more" : ""} of Canadian work.`,
    });
  }

  // ── C. Skill transferability ───────────────────────────────────────
  const group = credentialGroup(input.education);
  const band = languageBand(firstLevels);
  const cap = rules.transferability.groupCap;
  const tLines: FactorLine[] = [];

  const eduTable: Record<CredentialGroup, [number, number, number]> = { none: [0, 0, 0], post_secondary: [0, 13, 25], advanced: [0, 25, 50] };
  const eduLang = eduTable[group][band];
  const cweBand = cweYears >= 2 ? 2 : cweYears === 1 ? 1 : 0;
  const eduCwe = eduTable[group][cweBand];
  const eduTotal = Math.min(cap, eduLang + eduCwe);
  tLines.push({
    key: "transfer_education",
    label: "Education with language or Canadian work",
    points: eduTotal,
    max: cap,
    explanation:
      `Education with strong language: ${eduLang}. Education with Canadian work: ${eduCwe}.` +
      (eduLang + eduCwe > cap ? ` Together capped at ${cap}.` : "") +
      (group === "none" ? " Needs a post-secondary credential." : ""),
  });

  const fy = Math.max(0, Math.floor(input.foreignWorkYears));
  const fBand = fy >= 3 ? "advanced" : fy >= 1 ? "post_secondary" : "none";
  const forLang = eduTable[fBand][band];
  const forCwe = eduTable[fBand][cweBand];
  const forTotal = Math.min(cap, forLang + forCwe);
  tLines.push({
    key: "transfer_foreign_work",
    label: "Foreign work with language or Canadian work",
    points: forTotal,
    max: cap,
    explanation:
      `${plural(fy, "year")} of skilled foreign work. With strong language: ${forLang}. With Canadian work: ${forCwe}.` +
      (forLang + forCwe > cap ? ` Together capped at ${cap}.` : ""),
  });

  let coq = 0;
  if (input.certificateOfQualification && firstLevels) {
    const m = minClb(firstLevels);
    coq = m >= 7 ? 50 : m >= 5 ? 25 : 0;
  }
  tLines.push({
    key: "transfer_certificate",
    label: "Trade certificate with language",
    points: coq,
    max: cap,
    explanation: input.certificateOfQualification
      ? "Certificate of qualification from a province or territory, with CLB 5 or more on all four abilities (25) or CLB 7 or more (50)."
      : "No certificate of qualification in a trade.",
  });

  const tRaw = sum(tLines);
  const tPoints = Math.min(rules.transferability.totalCap, tRaw);
  if (tRaw > tPoints) warnings.push(`Skill transferability adds to ${tRaw} but is capped at ${tPoints}.`);

  // ── D. Additional points ───────────────────────────────────────────
  const a = rules.additional;
  const add: FactorLine[] = [];
  add.push({
    key: "provincial_nomination",
    label: "Provincial or territorial nomination",
    points: input.provincialNomination ? a.provincialNomination : 0,
    max: a.provincialNomination,
    explanation: input.provincialNomination ? "You have a nomination through an Express Entry-aligned provincial stream." : "No provincial nomination.",
  });

  let frenchPts = 0;
  let frenchExplain = "French results below NCLC 7 on at least one ability, or no French test.";
  if (input.french && minClb(input.french) >= 7) {
    const englishStrong = input.english !== null && minClb(input.english) >= 5;
    frenchPts = englishStrong ? a.frenchWithEnglish : a.frenchWithWeakOrNoEnglish;
    frenchExplain = englishStrong
      ? "NCLC 7 or more in all four French abilities and CLB 5 or more in all four English abilities."
      : "NCLC 7 or more in all four French abilities, with English at CLB 4 or lower or no English test.";
  }
  add.push({ key: "french", label: "Strong French skills", points: frenchPts, max: a.frenchWithEnglish, explanation: frenchExplain });

  const ce = input.canadianEducation;
  add.push({
    key: "canadian_education",
    label: "Post-secondary education in Canada",
    points: ce === "three_year_or_more" ? a.canadianEducationLong : ce === "one_or_two_year" ? a.canadianEducationShort : 0,
    max: a.canadianEducationLong,
    explanation:
      ce === "three_year_or_more"
        ? "A Canadian post-secondary credential of three years or longer."
        : ce === "one_or_two_year"
          ? "A one- or two-year Canadian post-secondary credential."
          : "No Canadian post-secondary credential.",
  });

  add.push({
    key: "sibling",
    label: "Brother or sister in Canada",
    points: input.siblingInCanada ? a.sibling : 0,
    max: a.sibling,
    explanation: input.siblingInCanada
      ? "A brother or sister aged 18 or older living in Canada who is a citizen or permanent resident (yours or your spouse's)."
      : "No eligible brother or sister in Canada.",
  });

  const addRaw = sum(add);
  const addPoints = Math.min(a.total, addRaw);

  // ── Totals ─────────────────────────────────────────────────────────
  const coreMax = withSpouse ? 460 : 500;
  const corePoints = sum(core);

  const sections: CrsSection[] = [
    { key: "core", label: "Core human capital", points: corePoints, max: rules.labourMarketIntegration ? (withSpouse ? 530 : 570) : coreMax, lines: core },
  ];
  if (withSpouse) sections.push({ key: "spouse", label: "Spouse or partner", points: sum(spouseLines), max: 40, lines: spouseLines });
  sections.push({ key: "transferability", label: "Skill transferability", points: tPoints, max: 100, lines: tLines });
  sections.push({ key: "additional", label: "Additional points", points: addPoints, max: a.total, lines: add });

  return {
    ruleSetVersion: rules.version,
    ruleSetSource: rules.sourceUrl,
    total: sections.reduce((t, s) => t + s.points, 0),
    sections,
    firstLanguageUsed: first,
    warnings,
  };
}
