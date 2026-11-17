import { describe, expect, it } from "vitest";
import { recommend } from "../lib/engine/recommend";
import { PROGRAMS } from "../lib/data/programs";
import type { Job, Profile } from "../lib/profile/schema";

const on = new Date("2026-11-17T00:00:00Z");
const job = (o: Partial<Job>): Job => ({ id: "j1", country: "canada", startDate: "2025-06-01", current: true, hoursPerWeek: 40, paid: true, teer: "1", nocCode: "21232", ...o });
const pgwp: Profile = {
  dateOfBirth: "1997-05-02",
  maritalStatus: "single",
  status: "pgwp",
  permitExpiryDate: "2027-03-01",
  educationLevel: "bachelors_or_three_year",
  educationEarnedIn: "canada",
  englishTest: { type: "ielts_gt", date: "2026-01-10", listening: 8, reading: 7, writing: 7, speaking: 7 },
  jobs: [job({})],
  province: "Alberta",
  willingToRelocate: "no",
  ruralOk: "no",
};

describe("recommendations", () => {
  it("puts CEC first for an eligible PGWP holder and explains why", () => {
    const r = recommend(pgwp, on);
    expect(r.potential[0].id).toBe("cec");
    expect(r.potential[0].reasons.join(" ")).toMatch(/CRS score would be about \d+/);
  });
  it("never lists closed programs as options", () => {
    const r = recommend({ ...pgwp, province: "Ontario", willingToRelocate: "yes" }, on);
    const ids = [...r.potential, ...r.needsInfo, ...r.notNow].map((x) => x.id);
    for (const p of PROGRAMS.filter((x) => x.status === "closed")) expect(ids).not.toContain(p.id);
  });
  it("only suggests provincial streams where the person would live", () => {
    const r = recommend(pgwp, on);
    const pnps = [...r.potential, ...r.needsInfo].filter((x) => x.kind === "pnp");
    expect(pnps.length).toBeGreaterThan(0);
    expect(pnps.every((x) => x.jurisdiction === "Alberta")).toBe(true);
  });
  it("never calls a provincial stream eligible", () => {
    const r = recommend({ ...pgwp, willingToRelocate: "yes" }, on);
    expect(r.potential.some((x) => x.kind === "pnp")).toBe(false);
  });
  it("respects not wanting rural life", () => {
    const r = recommend(pgwp, on);
    const rcip = [...r.potential, ...r.needsInfo, ...r.notNow].find((x) => x.id === "rcip");
    expect(rcip?.bucket).toBe("not_now");
  });
  it("plans around the permit expiry", () => {
    const r = recommend(pgwp, on);
    expect(r.plan.some((m) => m.due === "2027-03-01")).toBe(true);
  });
  it("sends out-of-status users to a professional first", () => {
    const r = recommend({ ...pgwp, status: "out_of_status", statusExpiredDate: "2026-10-01" }, on);
    expect(r.plan[0].title).toMatch(/licensed/);
  });
  it("is deterministic", () => {
    expect(recommend(pgwp, on)).toEqual(recommend(pgwp, on));
  });
  it("every program record names an official source and a check date", () => {
    for (const p of PROGRAMS) {
      expect(p.url).toMatch(/^https:\/\/(www\.)?(canada\.ca|ontario\.ca|welcomebc\.ca|alberta\.ca|saskatchewan\.ca|gnb\.ca|gov\.nl\.ca|immigratenwt\.ca|immigratemanitoba\.com|liveinnovascotia\.com|princeedwardisland\.ca|yukon\.ca|quebec\.ca)\//);
      expect(p.verifiedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });
});

describe("Francophone pilot", () => {
  it("is not suggested without French unless the person would learn it", () => {
    const base: Profile = { dateOfBirth: "1997-05-02", educationLevel: "secondary", educationEarnedIn: "canada", province: "Alberta", jobs: [job({ startDate: "2024-01-01" })] };
    const find = (p: Profile) => [...recommend(p, new Date("2026-11-17")).needsInfo, ...recommend(p, new Date("2026-11-17")).notNow].find((x) => x.id === "fcip")!;
    expect(find(base).bucket).toBe("not_now");
    expect(find({ ...base, learnFrench: "yes" }).bucket).toBe("needs_info");
  });
});
