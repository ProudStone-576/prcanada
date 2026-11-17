import { describe, expect, it } from "vitest";
import { ageOn, creditedHours, deriveCrs, highWageExperience, workYears } from "../lib/profile/derive";
import type { Job } from "../lib/profile/schema";

const on = new Date("2026-11-17T00:00:00Z");
const job = (over: Partial<Job>): Job => ({
  id: Math.random().toString(36).slice(2),
  country: "canada",
  startDate: "2024-11-17",
  current: true,
  hoursPerWeek: 40,
  paid: true,
  teer: "1",
  ...over,
});

describe("age", () => {
  it("counts birthdays exactly", () => {
    expect(ageOn("1997-11-17", on)).toBe(29);
    expect(ageOn("1997-11-18", on)).toBe(28);
  });
});

describe("work experience", () => {
  it("caps a week at 30 hours", () => {
    expect(workYears([job({})], on).canadian).toBe(2);
  });
  it("never double counts concurrent jobs", () => {
    const one = workYears([job({ hoursPerWeek: 30 })], on).canadian;
    const two = workYears([job({ hoursPerWeek: 30 }), job({ hoursPerWeek: 30 })], on).canadian;
    expect(two).toBe(one);
  });
  it("adds part-time jobs up to the weekly cap", () => {
    // two 15-hour jobs for one year = one year at 30 hours
    const hours = creditedHours([job({ hoursPerWeek: 15, startDate: "2025-11-17" }), job({ hoursPerWeek: 15, startDate: "2025-11-17" })], on);
    expect(Math.round(hours)).toBeGreaterThanOrEqual(1560);
  });
  it("ignores TEER 4/5, unknown TEER, unpaid, self-employed and full-time-student work in Canada", () => {
    const jobs = [job({ teer: "4" }), job({ teer: "unknown" }), job({ paid: false }), job({ selfEmployed: true }), job({ whileFullTimeStudent: true })];
    expect(workYears(jobs, on).canadian).toBe(0);
  });
  it("only counts the last 10 years", () => {
    expect(workYears([job({ startDate: "2010-01-01", endDate: "2014-01-01", current: false })], on).canadian).toBe(0);
  });
  it("needs 12 months at a high-wage level", () => {
    expect(highWageExperience([job({ highWage: "x1_5" })], on)).toBe("x1_5");
    expect(highWageExperience([job({ highWage: "x2", startDate: "2026-06-01" })], on)).toBe("none");
  });
});

describe("profile to CRS input", () => {
  it("lists what is missing instead of guessing", () => {
    const d = deriveCrs({}, on);
    expect(d.input).toBeNull();
    expect(d.missing.map((m) => m.step)).toEqual(expect.arrayContaining(["about", "education", "language"]));
  });
  it("gives foreign education no points without an ECA", () => {
    const d = deriveCrs({ dateOfBirth: "1997-01-01", educationLevel: "masters_or_professional", educationEarnedIn: "foreign" }, on);
    expect(d.input?.education).toBe("less_than_secondary");
    expect(d.missing.some((m) => m.message.includes("ECA"))).toBe(true);
  });
  it("scores a spouse who is a Canadian citizen as single", () => {
    const d = deriveCrs({ dateOfBirth: "1997-01-01", educationLevel: "bachelors_or_three_year", educationEarnedIn: "canada", maritalStatus: "married", spouseIsCitizenOrPr: "yes", spouseAccompanying: "yes" }, on);
    expect(d.input?.accompanyingSpouse).toBe(false);
  });
});
