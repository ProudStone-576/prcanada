/** Every official page the platform relies on, gathered from the rule sets and program records. */
import { PROGRAMS } from "../data/programs";
import { SRC } from "../sources";
import { SOURCES as EE } from "../engine/eligibility/rules";
import { TEMP_SOURCES } from "../engine/temporary";
import { CRS_RULE_SETS } from "../engine/crs/rules";
import { LANGUAGE_TABLE_SOURCE } from "../engine/language";

export interface WatchSeed {
  url: string;
  label: string;
  jurisdiction: string;
}

export function watchList(): WatchSeed[] {
  const seeds: WatchSeed[] = [
    ...CRS_RULE_SETS.map((r) => ({ url: r.sourceUrl, label: "CRS criteria", jurisdiction: "Federal" })),
    { url: SRC.crsChanges, label: "Express Entry changes", jurisdiction: "Federal" },
    { url: SRC.highWage, label: "High-wage occupations list", jurisdiction: "Federal" },
    { url: SRC.rounds, label: "Express Entry rounds of invitations", jurisdiction: "Federal" },
    { url: SRC.news, label: "IRCC newsroom", jurisdiction: "Federal" },
    { url: SRC.processingTimes, label: "Processing times", jurisdiction: "Federal" },
    { url: LANGUAGE_TABLE_SOURCE, label: "Language test equivalency", jurisdiction: "Federal" },
    { url: EE.cec, label: "Canadian Experience Class", jurisdiction: "Federal" },
    { url: EE.fsw, label: "Federal Skilled Worker Program", jurisdiction: "Federal" },
    { url: EE.fst, label: "Federal Skilled Trades Program", jurisdiction: "Federal" },
    { url: EE.categories, label: "Category-based selection", jurisdiction: "Federal" },
    { url: EE.funds, label: "Proof of funds", jurisdiction: "Federal" },
    { url: EE.eca, label: "Educational credential assessment", jurisdiction: "Federal" },
    ...Object.entries(TEMP_SOURCES).map(([k, url]) => ({ url, label: `Temporary status: ${k}`, jurisdiction: "Federal" })),
    ...PROGRAMS.map((p) => ({ url: p.url, label: p.name, jurisdiction: p.jurisdiction })),
    { url: "https://laws-lois.justice.gc.ca/eng/acts/i-2.5/", label: "Immigration and Refugee Protection Act", jurisdiction: "Federal" },
    { url: "https://laws-lois.justice.gc.ca/eng/regulations/SOR-2002-227/", label: "Immigration and Refugee Protection Regulations", jurisdiction: "Federal" },
  ];
  const seen = new Map<string, WatchSeed>();
  for (const s of seeds) if (!seen.has(s.url)) seen.set(s.url, s);
  return [...seen.values()];
}
