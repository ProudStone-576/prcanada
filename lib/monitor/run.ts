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
}

async function fetchText(url: string, fetcher: typeof fetch): Promise<{ ok: true; text: string } | { ok: false; status: string }> {
  try {
    const res = await fetcher(url, { headers: { "user-agent": USER_AGENT, accept: "text/html" }, redirect: "follow", signal: AbortSignal.timeout(30_000) });
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
export async function runMonitor(opts: { fetcher?: typeof fetch; delayMs?: number; only?: string[] } = {}): Promise<MonitorReport> {
  const fetcher = opts.fetcher ?? fetch;
  const delay = opts.delayMs ?? DELAY_MS;
  for (const seed of watchList()) {
    await db.sourceWatch.upsert({ where: { url: seed.url }, create: seed, update: { label: seed.label, jurisdiction: seed.jurisdiction } });
  }
  const watches = await db.sourceWatch.findMany({ where: opts.only ? { url: { in: opts.only } } : undefined, orderBy: { url: "asc" } });
  const report: MonitorReport = { checked: 0, changed: 0, first: 0, failed: [] };

  for (const w of watches) {
    const got = await fetchText(w.url, fetcher);
    report.checked++;
    const now = new Date();
    if (!got.ok) {
      report.failed.push({ url: w.url, status: got.status });
      await db.sourceWatch.update({ where: { id: w.id }, data: { lastFetchedAt: now, lastStatus: got.status } });
    } else {
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
    }
    if (delay) await new Promise((r) => setTimeout(r, delay));
  }
  return report;
}
