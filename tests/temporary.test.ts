import { describe, expect, it } from "vitest";
import { assessBowp, assessPgwp, assessSpousalOwp, pgwpLength, statusCheck } from "../lib/engine/temporary";

const on = new Date("2026-11-17T00:00:00Z");
const clb = (n: number) => ({ listening: n, reading: n, writing: n, speaking: n });

describe("PGWP", () => {
  it("calculates length from the program", () => {
    expect(pgwpLength("college", 12).months).toBe(12);
    expect(pgwpLength("college", 24).months).toBe(36);
    expect(pgwpLength("masters", 12).months).toBe(36);
    expect(pgwpLength("college", 6).months).toBeNull();
  });
  it("meets for an eligible degree graduate with CLB 7", () => {
    const r = assessPgwp({ credential: "bachelors", programMonths: 48, dliPgwpEligible: "yes", fullTimeEachTerm: "yes", atLeastHalfInClassInCanada: "yes", completionConfirmedOn: "2026-10-01", studyPermitValidInWindow: "yes", hadPgwpBefore: "no", language: clb(7) }, on);
    expect(r.verdict).toBe("meets");
    expect(r.requirements.some((x) => x.key === "field")).toBe(false);
  });
  it("needs CLB 7 for university and CLB 5 for college", () => {
    const base = { programMonths: 24, dliPgwpEligible: "yes" as const, fullTimeEachTerm: "yes" as const, atLeastHalfInClassInCanada: "yes" as const, completionConfirmedOn: "2026-10-01", studyPermitValidInWindow: "yes" as const, hadPgwpBefore: "no" as const, language: clb(6) };
    expect(assessPgwp({ ...base, credential: "masters" }, on).requirements.find((x) => x.key === "language")!.verdict).toBe("not_met");
    expect(assessPgwp({ ...base, credential: "college", studyPermitAppliedOnOrAfterNov2024: "no" }, on).requirements.find((x) => x.key === "language")!.verdict).toBe("meets");
  });
  it("asks about field of study for college programs", () => {
    const r = assessPgwp({ credential: "college", programMonths: 24 }, on);
    expect(r.requirements.find((x) => x.key === "field")!.verdict).toBe("needs_info");
  });
  it("flags a missed 180-day deadline and a second PGWP", () => {
    const r = assessPgwp({ credential: "bachelors", programMonths: 48, completionConfirmedOn: "2026-01-01", hadPgwpBefore: "yes" }, on);
    expect(r.requirements.find((x) => x.key === "deadline")!.verdict).toBe("not_met");
    expect(r.requirements.find((x) => x.key === "once")!.verdict).toBe("not_met");
  });
});

describe("spousal open work permit", () => {
  it("follows the January 2025 student rules", () => {
    expect(assessSpousalOwp({ principal: "student", studentProgram: "masters_16plus" }).requirements[0].verdict).toBe("meets");
    expect(assessSpousalOwp({ principal: "student", studentProgram: "other" }).verdict).toBe("not_met");
  });
  it("needs 16 months left for skilled workers", () => {
    expect(assessSpousalOwp({ principal: "worker", workerTeer: "1", monthsLeftOnPermit: 20 }).verdict).toBe("meets");
    expect(assessSpousalOwp({ principal: "worker", workerTeer: "1", monthsLeftOnPermit: 10 }).verdict).toBe("not_met");
  });
});

describe("bridging open work permit", () => {
  it("needs an AOR and status", () => {
    expect(assessBowp({ prProgram: "express_entry", principalApplicant: "yes", inCanada: "yes", aorReceived: "yes", status: "valid_permit" }).verdict).toBe("meets");
    expect(assessBowp({ prProgram: "express_entry", principalApplicant: "yes", inCanada: "yes", aorReceived: "no", status: "valid_permit" }).verdict).toBe("not_met");
  });
});

describe("status check", () => {
  it("computes the restoration deadline", () => {
    const a = statusCheck("out_of_status", undefined, "2026-10-01", on);
    expect(a[0].title).toBe("Restoration deadline: 2026-12-30");
  });
  it("warns that PGWPs can't usually be extended", () => {
    expect(statusCheck("pgwp", "2027-03-01", undefined, on).some((x) => /can't be extended/.test(x.title))).toBe(true);
  });
});
