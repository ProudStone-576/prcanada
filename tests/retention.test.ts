import { afterAll, describe, expect, it } from "vitest";
import { db } from "../lib/db";
import { runRetention } from "../lib/retention";

const emails = ["ret-active@retention.invalid", "ret-stale@retention.invalid", "ret-noticed@retention.invalid"];
const on = new Date("2026-11-18T00:00:00Z");
const ago = (days: number) => new Date(on.getTime() - days * 86400_000);

describe.skipIf(!process.env.DATABASE_URL)("retention", () => {
  afterAll(async () => {
    await db.user.deleteMany({ where: { email: { in: emails } } });
    await db.$disconnect();
  });
  it("notices after 24 months and deletes 30 days after the notice", async () => {
    await db.user.deleteMany({ where: { email: { in: emails } } });
    const base = { passwordHash: "x", consentAt: on, consentVersion: "t" };
    await db.user.create({ data: { ...base, email: emails[0], lastSeenAt: ago(30) } });
    await db.user.create({ data: { ...base, email: emails[1], lastSeenAt: ago(800) } });
    await db.user.create({ data: { ...base, email: emails[2], lastSeenAt: ago(800), retentionNoticeAt: ago(31) } });
    const r = await runRetention(on);
    expect(r.deleted).toBeGreaterThanOrEqual(1);
    const left = (await db.user.findMany({ where: { email: { in: emails } }, select: { email: true, retentionNoticeAt: true } }));
    expect(left.map((u) => u.email).sort()).toEqual([emails[0], emails[1]].sort());
    expect(left.find((u) => u.email === emails[1])!.retentionNoticeAt).not.toBeNull();
    expect(left.find((u) => u.email === emails[0])!.retentionNoticeAt).toBeNull();
    // running again the same day sends no second notice and deletes nothing new
    const again = await runRetention(on);
    expect(again.noticed).toBe(0);
  });
});
