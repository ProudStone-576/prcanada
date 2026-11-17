/**
 * NOC 2021 duty matching. Deterministic: BM25 ranking of the user's own
 * description of their duties against each unit group's lead statement and
 * main duties. Job titles are never used to rank; they are only compared
 * afterwards to warn when a title points somewhere the duties don't.
 *
 * The result is a suggestion for the user to check, never an assignment.
 */

export interface NocUnit {
  code: string;
  title: string;
  teer: number;
  broad: string;
  major: string;
  lead: string;
  duties: string[];
  examples: string[];
  requirements: string[];
  exclusions: string[];
}

export interface NocData {
  version: string;
  source: string;
  downloadedAt: string;
  units: NocUnit[];
}

export type DutyFit = "matches" | "partly" | "not_mentioned";

export interface NocCandidate {
  code: string;
  title: string;
  teer: number;
  major: string;
  lead: string;
  score: number;
  /** Share of this group's main duties the description covers, 0 to 1. */
  coverage: number;
  duties: Array<{ text: string; fit: DutyFit; shared: string[] }>;
  requirements: string[];
  exclusions: string[];
}

export interface NocMatch {
  ok: boolean;
  reason?: string;
  confidence: "strong" | "possible" | "weak" | null;
  candidates: NocCandidate[];
  titleNote: string | null;
  dataVersion: string;
}

const STOP = new Set(
  "a about above after again all also an and any are as at be been before being both but by can could did do does doing for from further had has have having he her here hers him his how i if in into is it its itself just me more most my no nor not of off on once only or other our out over own same she should so some such than that the their them then there these they this those through to too under until up very was we were what when where which while who whom why will with would you your yours etc e.g eg i.e ie may such as including include includes various related work works working duties duty responsible responsibilities job role daily".split(
    " ",
  ),
);

/** A small suffix stripper: enough to join "manage", "managing", "manages" and "management". */
export function stem(w: string): string {
  if (w.length <= 4) return w;
  for (const suf of ["izations", "ization", "ational", "fulness", "ments", "ment", "ings", "ing", "ations", "ation", "ions", "ion", "ers", "er", "ies", "ied", "es", "ed", "ly", "s"]) {
    if (w.endsWith(suf) && w.length - suf.length >= 4) {
      const base = w.slice(0, -suf.length);
      return suf === "ies" || suf === "ied" ? base + "y" : base;
    }
  }
  return w;
}

export function tokens(text: string): string[] {
  return (text.toLowerCase().match(/[a-z][a-z'-]+/g) ?? [])
    .map((t) => t.replace(/'s$/, "").replace(/^-+|-+$/g, ""))
    .filter((t) => t.length > 2 && !STOP.has(t))
    .map(stem);
}

interface Index {
  docs: Array<{ unit: NocUnit; tf: Map<string, number>; len: number; dutyTokens: string[][] }>;
  df: Map<string, number>;
  avgLen: number;
  titleIndex: Array<{ code: string; title: string; titleToks: Set<string>; examples: Array<Set<string>> }>;
}

const cache = new WeakMap<NocData, Index>();

function buildIndex(data: NocData): Index {
  const hit = cache.get(data);
  if (hit) return hit;
  const df = new Map<string, number>();
  const docs = data.units.map((unit) => {
    const dutyTokens = unit.duties.map(tokens);
    const all = [...tokens(unit.lead), ...dutyTokens.flat()];
    const tf = new Map<string, number>();
    for (const t of all) tf.set(t, (tf.get(t) ?? 0) + 1);
    for (const t of tf.keys()) df.set(t, (df.get(t) ?? 0) + 1);
    return { unit, tf, len: all.length, dutyTokens };
  });
  const avgLen = docs.reduce((s, d) => s + d.len, 0) / docs.length;
  const titleIndex = data.units.map((u) => ({ code: u.code, title: u.title, titleToks: new Set(tokens(u.title)), examples: u.examples.map((e) => new Set(tokens(e))) }));
  const idx = { docs, df, avgLen, titleIndex };
  cache.set(data, idx);
  return idx;
}

const K1 = 1.2;
const B = 0.75;
export const MIN_WORDS = 25;

export function matchNoc(data: NocData, dutiesText: string, jobTitle = "", limit = 5): NocMatch {
  const base = { confidence: null, candidates: [], titleNote: null, dataVersion: data.version };
  const words = dutiesText.trim().split(/\s+/).filter(Boolean).length;
  if (words < MIN_WORDS) {
    return { ...base, ok: false, reason: `Describe your duties in at least ${MIN_WORDS} words (you have ${words}). List the tasks you do most days, in your own words.` };
  }
  const idx = buildIndex(data);
  const N = idx.docs.length;
  const q = tokens(dutiesText);
  const qSet = new Set(q);
  if (qSet.size < 6) return { ...base, ok: false, reason: "We couldn't find enough specific words about your tasks. Add more detail about what you actually do." };

  const scored = idx.docs.map((d) => {
    let score = 0;
    for (const t of qSet) {
      const f = d.tf.get(t);
      if (!f) continue;
      const n = idx.df.get(t) ?? 0;
      const idf = Math.log(1 + (N - n + 0.5) / (n + 0.5));
      score += idf * ((f * (K1 + 1)) / (f + K1 * (1 - B + (B * d.len) / idx.avgLen)));
    }
    return { d, score };
  });
  scored.sort((a, b) => b.score - a.score || a.d.unit.code.localeCompare(b.d.unit.code));

  const candidates: NocCandidate[] = scored.slice(0, limit).map(({ d, score }) => {
    const duties = d.unit.duties.map((text, i) => {
      const dt = [...new Set(d.dutyTokens[i])];
      const shared = dt.filter((t) => qSet.has(t));
      const share = dt.length ? shared.length / dt.length : 0;
      const fit: DutyFit = shared.length >= 2 && share >= 0.4 ? "matches" : shared.length >= 1 && share >= 0.2 ? "partly" : "not_mentioned";
      return { text, fit, shared };
    });
    const covered = duties.filter((x) => x.fit === "matches").length + 0.5 * duties.filter((x) => x.fit === "partly").length;
    return {
      code: d.unit.code,
      title: d.unit.title,
      teer: d.unit.teer,
      major: d.unit.major,
      lead: d.unit.lead,
      score: Math.round(score * 10) / 10,
      coverage: duties.length ? Math.round((covered / duties.length) * 100) / 100 : 0,
      duties,
      requirements: d.unit.requirements,
      exclusions: d.unit.exclusions,
    };
  });

  const [top, second] = candidates;
  const margin = second && top.score > 0 ? (top.score - second.score) / top.score : 1;
  const confidence: NocMatch["confidence"] =
    top.coverage >= 0.4 && margin >= 0.15 ? "strong" : top.coverage >= 0.25 ? "possible" : "weak";

  let titleNote: string | null = null;
  const titleToks = new Set(tokens(jobTitle));
  if (titleToks.size) {
    const all = (set: Set<string>) => [...titleToks].every((x) => set.has(x));
    const best = idx.titleIndex
      .map((t) => ({ t, score: (all(t.titleToks) ? 100 : 0) + t.examples.filter(all).length }))
      .sort((a, b) => b.score - a.score || a.t.code.localeCompare(b.t.code))[0];
    if (best && best.score > 0 && !candidates.slice(0, 3).some((c) => c.code === best.t.code)) {
      titleNote = `Your job title looks like NOC ${best.t.code} (${best.t.title}), but your duties point elsewhere. IRCC goes by the duties you actually perform, so check both descriptions carefully.`;
    }
  }

  return { ok: true, confidence, candidates, titleNote, dataVersion: data.version };
}
