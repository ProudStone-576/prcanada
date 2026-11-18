import { describe, expect, it } from "vitest";
import { diffLines, hashText, htmlToText, normalize } from "../lib/monitor/text";
import { watchList } from "../lib/monitor/sources";
import { buildNotices, thresholdFor } from "../lib/notify/build";

const page = (body: string, modified = "2026-10-16") => `<html><head><script>var x=1</script><style>p{}</style></head><body>
<header><nav><a>Home</a></nav></header>
<main><h1>Express Entry: who can apply</h1><p>You need at least 1 year of work.</p><ul><li>CLB 7</li><li>TEER 0 &amp; 1</li></ul>${body}
<dl><dt>Date modified:</dt><dd>${modified}</dd></dl></main><footer>Canada.ca</footer></body></html>`;

describe("page text", () => {
  it("keeps the main content and drops scripts, navigation and footers", () => {
    const t = htmlToText(page(""));
    expect(t).toContain("Express Entry: who can apply");
    expect(t).toContain("- TEER 0 & 1");
    expect(t).not.toMatch(/var x|Home|Canada\.ca/);
  });
  it("ignores date-modified stamps so a republish isn't a change", () => {
    const a = normalize(htmlToText(page("", "2026-10-16")));
    const b = normalize(htmlToText(page("", "2026-11-18")));
    expect(hashText(a)).toBe(hashText(b));
  });
  it("reports exactly what was added and removed", () => {
    const a = normalize(htmlToText(page("<p>Invitation rounds are paused.</p>")));
    const b = normalize(htmlToText(page("<p>Invitation rounds have resumed.</p>")));
    expect(diffLines(a, b)).toEqual({ added: ["Invitation rounds have resumed."], removed: ["Invitation rounds are paused."] });
  });
  it("doesn't report moved lines that stayed the same", () => {
    expect(diffLines("a\nb\nc", "a\nb\nc\nd")).toEqual({ added: ["d"], removed: [] });
  });
});

describe("watch list", () => {
  it("covers every official source once", () => {
    const urls = watchList().map((w) => w.url);
    expect(new Set(urls).size).toBe(urls.length);
    expect(urls.length).toBeGreaterThan(40);
    expect(urls.every((u) => u.startsWith("https://"))).toBe(true);
  });
});

describe("reminders", () => {
  const on = new Date("2026-11-18T00:00:00Z");
  it("picks the tightest threshold crossed", () => {
    expect(thresholdFor(120)).toBeNull();
    expect(thresholdFor(90)).toBe(90);
    expect(thresholdFor(45)).toBe(90);
    expect(thresholdFor(30)).toBe(30);
    expect(thresholdFor(3)).toBe(7);
    expect(thresholdFor(0)).toBe(1);
    expect(thresholdFor(-1)).toBeNull();
  });
  it("builds stable keys so a reminder is never repeated", () => {
    const p = { status: "pgwp" as const, permitExpiryDate: "2027-01-10" };
    const a = buildNotices(p, [], [], on);
    const b = buildNotices(p, [], [], on);
    expect(a).toEqual(b);
    expect(a[0].key).toBe("deadline:permit_expiry:2027-01-10:90");
    expect(a[0].title).toMatch(/in 53 days/);
  });
  it("moves to a new key at the next threshold", () => {
    const p = { status: "pgwp" as const, permitExpiryDate: "2026-12-10" };
    expect(buildNotices(p, [], [], on)[0].key).toBe("deadline:permit_expiry:2026-12-10:30");
  });
  it("includes custom reminders and document expiry", () => {
    const docs = [{ id: "d1", docType: "passport" as const, createdAt: "2026-01-01", meta: { filename: "p.pdf", text: null, textStatus: "image" as const, suggested: { notes: [] }, confirmed: { expiresOn: "2026-11-25" } } }];
    const n = buildNotices({}, [{ id: "u1", title: "Biometrics", dueDate: "2026-11-19" }], docs, on);
    expect(n.map((x) => x.key)).toEqual(["custom:u1:2026-11-19:1", "doc:d1:2026-11-25:7"]);
  });
});
