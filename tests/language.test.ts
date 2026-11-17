import { describe, expect, it } from "vitest";
import { scoreToClb, scoresToClb, testIsValid } from "../lib/engine/language";

describe("language conversion (IRCC charts, page date 2026-10-16)", () => {
  it("IELTS General Training", () => {
    expect(scoresToClb("ielts_gt", { listening: 8, reading: 7, writing: 7, speaking: 7 })).toEqual({ listening: 9, reading: 9, writing: 9, speaking: 9 });
    expect(scoreToClb("ielts_gt", "listening", 7.5)).toBe(8);
    expect(scoreToClb("ielts_gt", "listening", 6.5)).toBe(7);
    expect(scoreToClb("ielts_gt", "reading", 8.5)).toBe(10);
    expect(scoreToClb("ielts_gt", "reading", 3)).toBe(0);
  });
  it("CELPIP-General levels map one to one, capped at 10", () => {
    expect(scoreToClb("celpip_g", "speaking", 12)).toBe(10);
    expect(scoreToClb("celpip_g", "speaking", 7)).toBe(7);
    expect(scoreToClb("celpip_g", "speaking", 3)).toBe(0);
  });
  it("PTE Core", () => {
    expect(scoreToClb("pte_core", "writing", 89)).toBe(9);
    expect(scoreToClb("pte_core", "writing", 90)).toBe(10);
    expect(scoreToClb("pte_core", "listening", 60)).toBe(7);
  });
  it("TEF Canada uses the old-score equivalents", () => {
    expect(scoreToClb("tef_canada", "speaking", 310)).toBe(7);
    expect(scoreToClb("tef_canada", "reading", 206)).toBe(6);
  });
  it("TCF Canada", () => {
    expect(scoreToClb("tcf_canada", "writing", 13)).toBe(8);
    expect(scoreToClb("tcf_canada", "listening", 549)).toBe(10);
  });
  it("rejects impossible scores", () => {
    expect(() => scoreToClb("ielts_gt", "reading", 9.5)).toThrow(RangeError);
  });
  it("results expire after two years", () => {
    expect(testIsValid("2024-11-18", new Date("2026-11-17"))).toBe(true);
    expect(testIsValid("2024-11-17", new Date("2026-11-17"))).toBe(false);
  });
});
