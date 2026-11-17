import { describe, expect, it } from "vitest";
import data from "../lib/data/noc-2021.json";
import { matchNoc, type NocData } from "../lib/engine/noc/match";

const noc = data as NocData;

describe("NOC 2021 data", () => {
  it("has all 516 unit groups with TEER from the code", () => {
    expect(noc.units).toHaveLength(516);
    expect(noc.units.every((u) => u.teer === Number(u.code[1]))).toBe(true);
  });
});

describe("duty matching", () => {
  it("refuses short descriptions instead of guessing", () => {
    expect(matchNoc(noc, "I write code").ok).toBe(false);
  });
  it("finds software developers from duties", () => {
    const r = matchNoc(noc, "I design, write and test code for new software features in our web and mobile applications. I debug and correct code, modify and integrate existing programs, and write documentation for new and updated software. I also analyze requirements to plan modifications to our systems.");
    expect(r.candidates.slice(0, 3).map((c) => c.code)).toContain("21232");
  });
  it("finds registered nurses from duties", () => {
    const r = matchNoc(noc, "I assess patients, plan and provide nursing care, administer medications and treatments prescribed by physicians, monitor patients and record their condition, educate patients and families about health, and work with physicians and other health team members on hospital wards.");
    expect(r.candidates.slice(0, 3).map((c) => c.code)).toContain("31301");
  });
  it("finds cooks from duties", () => {
    const r = matchNoc(noc, "I prepare and cook complete meals and individual dishes and foods in the restaurant kitchen, inspect kitchens and food service areas, order supplies and equipment, schedule and supervise kitchen helpers, and maintain inventory and records of food and supplies used.");
    expect(r.candidates.slice(0, 3).map((c) => c.code)).toContain("63200");
  });
  it("ignores the job title when ranking and warns when it points elsewhere", () => {
    const duties = "I assess patients, plan and provide nursing care, administer medications and treatments prescribed by physicians, monitor patients and record their condition, educate patients and families about health, and work with physicians on hospital wards.";
    const a = matchNoc(noc, duties, "");
    const b = matchNoc(noc, duties, "software developer");
    expect(b.candidates.map((c) => c.code)).toEqual(a.candidates.map((c) => c.code));
    expect(b.titleNote).toMatch(/21232/);
  });
  it("is deterministic", () => {
    const t = "I prepare and cook meals in a restaurant kitchen, order supplies, supervise kitchen helpers and keep inventory records of food used every week for the owner.";
    expect(matchNoc(noc, t)).toEqual(matchNoc(noc, t));
  });
});
