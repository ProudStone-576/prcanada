import "server-only";
import { db } from "../db";
import { diffLines, hashText, htmlToText, normalize } from "./text";
import { watchList } from "./sources";

const USER_AGENT = "PRPathCanada-SourceMonitor/1.0";
const DELAY_MS = 1500;

export interface MonitorReport {
  checked: number;
  changed: number;
  first: number;
  failed: Array<{ url: string; status: string }>;
  /** Pages not reached because the run hit its time budget; they go first next run. */
  skipped: number;
}

async function fetchText(url: string, fetcher: typeof fetch): Promise<{ ok: true; text: string } | { ok: false; status: string }> {
  try {
    const res = await fetcher(url, { headers: { "user-agent": USER_AGENT, accept: "text/html" }, redirect: "follow", signal: AbortSignal.timeout(20_000) });
    if (!res.ok) return { ok: false, status: `HTTP ${res.status}` };
    const type = res.headers.get("content-type") ?? "";
    if (!type.includes("html")) return { ok: false, status: `Not HTML (${type || "unknown"})` };
    const text = normalize(htmlToText(await res.text()));
    if (text.length < 200) return { ok: false, status: "Page had too little text (possibly a bot check)" };
    return { ok: true, text };
  } catch (e) {
    return { ok: false, status: (e as Error).name === "TimeoutError" ? "Timed out" : "Network error" };
  }
}

/**
 * Check every watched page once. A change opens a review item for a person;
 * nothing about the site's rules or statuses changes automatically.
 */
export async function runMonitor(opts: { fetcher?: typeof fetch; delayMs?: number; only?: string[]; budgetMs?: number } = {}): Promise<MonitorReport> {
  const fetcher = opts.fetcher ?? fetch;
  const delay = opts.delayMs ?? DELAY_MS;
  for (const seed of watchList()) {
    await db.sourceWatch.upsert({ where: { url: seed.url }, create: seed, update: { label: seed.label, jurisdiction: seed.jurisdiction } });
  }
  // Least recently checked first, so a run cut short by the time budget resumes where it stopped next time.
  const watches = await db.sourceWatch.findMany({
    where: opts.only ? { url: { in: opts.only } } : undefined,
    orderBy: [{ lastFetchedAt: { sort: "asc", nulls: "first" } }, { url: "asc" }],
  });
  const report: MonitorReport = { checked: 0, changed: 0, first: 0, failed: [], skipped: 0 };
  const started = Date.now();
  // Worst case: budget (200 s) + one batch of four same-host pages at 20 s each = 280 s, inside the route's 300 s.
  const budget = opts.budgetMs ?? 200_000;

  const checkOne = async (w: (typeof watches)[number]) => {
    const got = await fetchText(w.url, fetcher);
    report.checked++;
    const now = new Date();
    if (!got.ok) {
      report.failed.push({ url: w.url, status: got.status });
      await db.sourceWatch.update({ where: { id: w.id }, data: { lastFetchedAt: now, lastStatus: got.status } });
      return;
    }
    const hash = hashText(got.text);
    if (!w.lastHash) {
      report.first++;
      await db.sourceWatch.update({ where: { id: w.id }, data: { lastHash: hash, lastText: got.text, lastFetchedAt: now, lastStatus: "Baseline saved" } });
    } else if (hash !== w.lastHash) {
      const { added, removed } = diffLines(w.lastText ?? "", got.text);
      report.changed++;
      await db.$transaction([
        db.reviewItem.create({ data: { watchId: w.id, added: added.slice(0, 200), removed: removed.slice(0, 200) } }),
        db.sourceWatch.update({ where: { id: w.id }, data: { lastHash: hash, lastText: got.text, lastFetchedAt: now, lastStatus: "Changed", lastChangedAt: now } }),
      ]);
    } else {
      await db.sourceWatch.update({ where: { id: w.id }, data: { lastFetchedAt: now, lastStatus: "No change" } });
    }
  };

  // A few pages at a time, never the same host twice at once.
  const CONCURRENCY = 4;
  for (let i = 0; i < watches.length; i += CONCURRENCY) {
    if (Date.now() - started > budget) {
      report.skipped = watches.length - i;
      break;
    }
    const batch: typeof watches = [];
    const hosts = new Set<string>();
    for (const w of watches.slice(i, i + CONCURRENCY)) {
      const host = new URL(w.url).host;
      if (hosts.has(host)) await checkOne(w);
      else {
        hosts.add(host);
        batch.push(w);
      }
    }
    await Promise.all(batch.map(checkOne));
    if (delay) await new Promise((r) => setTimeout(r, delay));
  }
  return report;
}
