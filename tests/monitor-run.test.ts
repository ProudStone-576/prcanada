/** Integration test against the real database (skipped when DATABASE_URL isn't set). */
import { afterAll, describe, expect, it } from "vitest";
import { db } from "../lib/db";
import { runMonitor } from "../lib/monitor/run";

const urls = Array.from({ length: 8 }, (_, i) => `https://slow-${i}.monitor-test.invalid/page`);
const page = (v: string) => `<html><body><main><h1>Test page</h1><p>${"This page has enough words to pass the minimum length check for monitored pages. ".repeat(4)}</p><p>${v}</p></main></body></html>`;
let version = "Version A";
const fakeFetch = (async () => {
  await new Promise((r) => setTimeout(r, 60));
  return new Response(page(version), { headers: { "content-type": "text/html" } });
}) as unknown as typeof fetch;

describe.skipIf(!process.env.DATABASE_URL)("monitor run", () => {
  afterAll(async () => {
    await db.sourceWatch.deleteMany({ where: { url: { in: urls } } });
    await db.$disconnect();
  });

  it("stops at its time budget, reports skipped pages, and resumes with them next run", async () => {
    for (const url of urls) await db.sourceWatch.upsert({ where: { url }, create: { url, label: "test", jurisdiction: "Test" }, update: { lastFetchedAt: null, lastHash: null } });
    const first = await runMonitor({ fetcher: fakeFetch, delayMs: 0, only: urls, budgetMs: 1 });
    expect(first.checked).toBeGreaterThan(0);
    expect(first.skipped).toBeGreaterThan(0);
    expect(first.checked + first.skipped).toBe(urls.length);
    const done = new Set((await db.sourceWatch.findMany({ where: { url: { in: urls }, lastFetchedAt: { not: null } }, select: { url: true } })).map((w) => w.url));
    const second = await runMonitor({ fetcher: fakeFetch, delayMs: 0, only: urls, budgetMs: 1 });
    const now = await db.sourceWatch.findMany({ where: { url: { in: urls } }, orderBy: { lastFetchedAt: "desc" }, take: second.checked, select: { url: true } });
    expect(now.every((w) => !done.has(w.url))).toBe(true); // the second run started with pages the first skipped
  });

  it("opens one review per changed page and none when nothing changed", async () => {
    await runMonitor({ fetcher: fakeFetch, delayMs: 0, only: urls });
    const before = await db.reviewItem.count({ where: { watch: { url: { in: urls } } } });
    const same = await runMonitor({ fetcher: fakeFetch, delayMs: 0, only: urls });
    expect(same.changed).toBe(0);
    version = "Version B";
    const changed = await runMonitor({ fetcher: fakeFetch, delayMs: 0, only: urls });
    expect(changed.changed).toBe(urls.length);
    expect(await db.reviewItem.count({ where: { watch: { url: { in: urls } } } })).toBe(before + urls.length);
  });
});
