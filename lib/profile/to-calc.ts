import { DEFAULT_STATE, type CalcState, type CalcTest } from "../engine/crs/calc-state";
import { deriveCrs } from "./derive";
import type { LanguageTest, Profile } from "./schema";

const t = (x?: LanguageTest | null): CalcTest | null =>
  x ? { type: x.type, listening: x.listening, reading: x.reading, writing: x.writing, speaking: x.speaking } : null;

/** Prefill the calculator from saved answers. Returns null when the profile can't be scored yet. */
export function calcStateFromProfile(p: Profile, on: Date): CalcState | null {
  const d = deriveCrs(p, on);
  if (!d.input) return null;
  const i = d.input;
  return {
    ...DEFAULT_STATE,
    age: Math.max(16, Math.min(80, i.age)),
    spouse: i.accompanyingSpouse,
    education: i.education,
    english: t(p.englishTest),
    french: t(p.frenchTest),
    canadianWorkYears: Math.min(10, i.canadianWorkYears),
    foreignWorkYears: Math.min(10, i.foreignWorkYears),
    highWageExperience: i.highWageExperience,
    jobOffer: i.jobOffer,
    certificateOfQualification: i.certificateOfQualification,
    canadianEducation: i.canadianEducation,
    siblingInCanada: i.siblingInCanada,
    provincialNomination: i.provincialNomination,
    spouseEducation: i.spouse?.education ?? DEFAULT_STATE.spouseEducation,
    spouseTest: i.accompanyingSpouse ? t(p.spouseTest) : null,
    spouseCanadianWorkYears: Math.min(10, Math.floor(i.spouse?.canadianWorkYears ?? 0)),
  };
}
