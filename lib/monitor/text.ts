/**
 * Turning an official web page into comparable text, and comparing two
 * versions. Pure functions, so the monitor's behaviour is testable without
 * the network.
 */
import { createHash } from "node:crypto";

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", rsquo: "’", lsquo: "‘", ldquo: "“", rdquo: "”", ndash: "-", mdash: "-", eacute: "é", egrave: "è", agrave: "à", ccedil: "ç" };

function decode(s: string): string {
  return s
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&([a-z]+);/gi, (m, n) => ENTITIES[n.toLowerCase()] ?? m);
}

/** The readable text of a page: its <main> if present, without scripts, styles, navigation, headers or footers. */
export function htmlToText(html: string): string {
  let h = html.replace(/<!--[\s\S]*?-->/g, " ");
  const main = h.match(/<main\b[^>]*>([\s\S]*?)<\/main>/i);
  if (main) h = main[1];
  h = h.replace(/<(script|style|noscript|svg|nav|header|footer|form|template)\b[\s\S]*?<\/\1>/gi, " ");
  h = h.replace(/<(br|\/p|\/div|\/li|\/h[1-6]|\/tr|\/td|\/th|\/dt|\/dd|\/section|\/article|\/table)\b[^>]*>/gi, "\n");
  h = h.replace(/<li\b[^>]*>/gi, "\n- ");
  h = h.replace(/<[^>]+>/g, " ");
  return decode(h)
    .split("\n")
    .map((l) => l.replace(/[ \t ]+/g, " ").trim())
    .filter(Boolean)
    .join("\n");
}

/** Lines that change on every visit or every republish without changing meaning. */
const NOISE = [
  /^date modified:?/i,
  /^page details$/i,
  /^(last )?updated:? /i,
  /^report a problem/i,
  /^share this page$/i,
  /^error loading/i,
  /^\d{4}-\d{2}-\d{2}$/,
];

export function normalize(text: string): string {
  return text
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l && !NOISE.some((re) => re.test(l)))
    .join("\n");
}

export function hashText(text: string): string {
  return createHash("sha256").update(text).digest("hex");
}

/**
 * Lines added and removed between two versions, using a longest common
 * subsequence so moved-but-unchanged content isn't reported.
 */
export function diffLines(before: string, after: string, max = 2000): { added: string[]; removed: string[] } {
  const a = before.split("\n").slice(0, max);
  const b = after.split("\n").slice(0, max);
  const n = a.length;
  const m = b.length;
  const dp: Uint16Array[] = Array.from({ length: n + 1 }, () => new Uint16Array(m + 1));
  for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--) dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
  const added: string[] = [];
  const removed: string[] = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (a[i] === b[j]) {
      i++;
      j++;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) removed.push(a[i++]);
    else added.push(b[j++]);
  }
  while (i < n) removed.push(a[i++]);
  while (j < m) added.push(b[j++]);
  return { added, removed };
}
