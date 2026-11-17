import { describe, expect, it } from "vitest";
import { assessCategories, assessCec, assessFst, assessFsw } from "../lib/engine/eligibility/express-entry";
import { fundsRequired, isFstTrade } from "../lib/engine/eligibility/rules";
import type { Job, Profile } from "../lib/profile/schema";

const on = new Date("2026-11-17T00:00:00Z");
const job = (o: Partial<Job>): Job => ({ id: Math.random().toString(36).slice(2), country: "canada", startDate: "2025-06-01", current: true, hoursPerWeek: 40, paid: true, teer: "1", nocCode: "21232", ...o });
const ielts = (l: number, r: number, w: number, s: number) => ({ type: "ielts_gt" as const, date: "2026-01-10", listening: l, reading: r, writing: w, speaking: s });
const base: Profile = {
  dateOfBirth: "1997-05-02",
  maritalStatus: "single",
  status: "pgwp",
  educationLevel: "bachelors_or_three_year",
  educationEarnedIn: "canada",
  englishTest: ielts(8, 7, 7, 7),
  jobs: [job({})],
  province: "Ontario",
};
const req = (r: ReturnType<typeof assessCec>, k: string) => r.requirements.find((x) => x.key === k)!;

describe("Canadian Experience Class", () => {
  it("meets with a year of TEER 1 work and CLB 9", () => {
    expect(assessCec(base, on).verdict).toBe("meets");
  });
  it("needs CLB 7 for TEER 0 or 1 experience", () => {
    const r = assessCec({ ...base, englishTest: ielts(5.5, 5, 5.5, 5.5) }, on);
    expect(req(r, "language").verdict).toBe("not_met");
  });
  it("accepts CLB 5 for TEER 2 or 3 experience", () => {
    const r = assessCec({ ...base, englishTest: ielts(5, 4, 5, 5), jobs: [job({ teer: "2", nocCode: "72200" })] }, on);
    expect(req(r, "language").verdict).toBe("meets");
  });
  it("does not count work done as a full-time student or self-employed", () => {
    const r = assessCec({ ...base, jobs: [job({ whileFullTimeStudent: true }), job({ selfEmployed: true })] }, on);
    expect(req(r, "work").verdict).toBe("not_met");
  });
  it("only counts the last 3 years", () => {
    const r = assessCec({ ...base, jobs: [job({ startDate: "2020-01-01", endDate: "2022-12-31", current: false })] }, on);
    expect(req(r, "work").verdict).toBe("not_met");
  });
  it("asks for TEER instead of guessing", () => {
    const r = assessCec({ ...base, jobs: [job({ teer: "unknown" })] }, on);
    expect(req(r, "work").verdict).toBe("needs_info");
  });
  it("rejects expired language results", () => {
    const r = assessCec({ ...base, englishTest: { ...ielts(8, 7, 7, 7), date: "2024-01-01" } }, on);
    expect(req(r, "language").verdict).toBe("not_met");
  });
  it("flags plans to settle only in Quebec", () => {
    expect(req(assessCec({ ...base, preferredProvinces: ["Quebec"] }, on), "quebec").verdict).toBe("not_met");
  });
});

describe("Federal Skilled Worker Program", () => {
  it("scores the 67-point grid", () => {
    // Language CLB 9 x4 = 24, bachelor's 21, 1 year experience 9, age 29 = 12, no offer 0,
    // adaptability: own Canadian work 10 → capped 10. Total 76.
    const r = assessFsw({ ...base, settlementFunds: 20000 }, on);
    expect(r.points!.total).toBe(76);
    expect(r.verdict).toBe("meets");
  });
  it("requires CLB 7 in all four abilities", () => {
    const r = assessFsw({ ...base, englishTest: ielts(8, 7, 7, 5.5), settlementFunds: 20000 }, on);
    expect(r.requirements.find((x) => x.key === "language")!.verdict).toBe("not_met");
  });
  it("asks for funds unless authorized to work with a job offer", () => {
    expect(assessFsw(base, on).requirements.find((x) => x.key === "funds")!.verdict).toBe("needs_info");
    expect(assessFsw({ ...base, jobOfferValid: "yes", jobOfferTeer: "1" }, on).requirements.find((x) => x.key === "funds")!.verdict).toBe("meets");
  });
  it("needs an ECA for foreign education", () => {
    const r = assessFsw({ ...base, educationEarnedIn: "foreign", settlementFunds: 20000 }, on);
    expect(r.requirements.find((x) => x.key === "education")!.verdict).toBe("not_met");
  });
  it("needs a year in one occupation, not across several", () => {
    const r = assessFsw({ ...base, jobs: [job({ startDate: "2026-02-01", nocCode: "21232" }), job({ startDate: "2025-08-01", endDate: "2026-01-31", current: false, nocCode: "21211" })] }, on);
    expect(r.requirements.find((x) => x.key === "work")!.verdict).toBe("not_met");
  });
});

describe("Federal Skilled Trades Program", () => {
  it("recognizes eligible trade groups", () => {
    expect(isFstTrade("72200")).toBe(true);
    expect(isFstTrade("72600")).toBe(false); // sub-major group 726 excluded
    expect(isFstTrade("93100")).toBe(true);
    expect(isFstTrade("93200")).toBe(false); // 932 excluded
    expect(isFstTrade("63200")).toBe(true);
    expect(isFstTrade("62200")).toBe(true);
    expect(isFstTrade("21232")).toBe(false);
  });
  it("needs 2 years in the trade and an offer or certificate", () => {
    const electrician: Profile = { ...base, englishTest: ielts(5, 3.5, 4, 5), jobs: [job({ startDate: "2023-01-01", teer: "2", nocCode: "72200" })], certificateOfQualification: "yes", settlementFunds: 20000 };
    expect(assessFst(electrician, on).verdict).toBe("meets");
    expect(assessFst({ ...electrician, certificateOfQualification: "no", jobOfferValid: "no" }, on).verdict).toBe("not_met");
  });
});

describe("categories", () => {
  it("matches an occupation on the list with 12 months in 3 years", () => {
    const nurse: Profile = { ...base, jobs: [job({ nocCode: "31301" })] };
    expect(assessCategories(nurse, on).find((c) => c.key === "healthcare")!.verdict).toBe("meets");
  });
  it("does not count foreign work for Canada-only categories", () => {
    const md: Profile = { ...base, jobs: [job({ nocCode: "31102", country: "foreign" })] };
    const r = assessCategories(md, on);
    expect(r.find((c) => c.key === "healthcare")!.verdict).toBe("meets");
    expect(r.find((c) => c.key === "physicians")!.verdict).toBe("not_met");
  });
  it("software developers are not on the current STEM list", () => {
    expect(assessCategories(base, on).find((c) => c.key === "stem")!.verdict).toBe("not_met");
  });
});

describe("funds table", () => {
  it("follows IRCC's table and adds per extra person", () => {
    expect(fundsRequired(1)).toBe(15263);
    expect(fundsRequired(7)).toBe(40392);
    expect(fundsRequired(9)).toBe(40392 + 2 * 4112);
  });
});
