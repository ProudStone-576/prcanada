import { describe, expect, it } from "vitest";
import { analyzeRefusal } from "../lib/engine/refusal";

const on = new Date("2026-11-17T00:00:00Z");
const studyRefusal = `Dear Applicant, Thank you for your interest in studying in Canada. After a careful review of your study permit application and supporting documentation, I have determined that your application does not meet the requirements of the Immigration and Refugee Protection Act and Regulations. Your application is refused.
I am not satisfied that you will leave Canada at the end of your stay, as stipulated in paragraph 216(1)(b) of the IRPR, based on:
- your family ties in Canada and in your country of residence
- the purpose of your visit
- your personal assets and financial status
- your study plan is not reasonable given your educational background`;

describe("refusal analysis", () => {
  it("identifies a study permit refusal and its grounds with the right regulations", () => {
    const r = analyzeRefusal({ text: studyRefusal, notifiedOn: "2026-11-10", where: "outside_canada" }, on);
    expect(r.appType).toBe("study_permit");
    const keys = r.grounds.map((g) => g.key);
    expect(keys).toEqual(expect.arrayContaining(["leave_end_of_stay", "family_ties", "purpose", "financial", "study_plan"]));
    expect(r.grounds.find((g) => g.key === "leave_end_of_stay")!.law[0].cite).toBe("IRPR s. 216(1)(b)");
    expect(r.grounds.find((g) => g.key === "financial")!.law[0].cite).toBe("IRPR s. 220");
  });
  it("calculates the judicial review deadline: 60 days outside Canada, 15 inside", () => {
    expect(analyzeRefusal({ text: studyRefusal, notifiedOn: "2026-11-10", where: "outside_canada" }, on).deadlines[0].date).toBe("2027-01-09");
    expect(analyzeRefusal({ text: studyRefusal, notifiedOn: "2026-11-10", where: "in_canada" }, on).deadlines[0].date).toBe("2026-11-25");
  });
  it("never puts reapplying first and always separates challenges from new applications", () => {
    const r = analyzeRefusal({ text: studyRefusal, where: "outside_canada" }, on);
    expect(r.nextSteps[0].key).toBe("professional");
    expect(r.nextSteps.find((s) => s.key === "new_application")!.kind).toBe("administrative");
    expect(r.nextSteps.find((s) => s.key === "judicial_review")!.kind).toBe("legal_challenge");
  });
  it("flags misrepresentation and requires professional review", () => {
    const r = analyzeRefusal({ text: studyRefusal + "\nYou are inadmissible to Canada under paragraph 40(1)(a) of the Act for misrepresentation." }, on);
    expect(r.flags.map((f) => f.key)).toContain("misrepresentation");
    expect(r.needsProfessional).toBe(true);
  });
  it("treats an in-Canada PGWP refusal as possible loss of status with a restoration window", () => {
    const text = "Your application for a post-graduation work permit has been refused. You do not meet the requirements because your program of study was not eligible. Applicants in Canada whose application is refused should review their status and options carefully before the end of the period.";
    const r = analyzeRefusal({ text, notifiedOn: "2026-11-01" }, on);
    expect(r.appType).toBe("pgwp");
    expect(r.flags.map((f) => f.key)).toContain("status_loss");
    expect(r.deadlines.find((d) => d.title.startsWith("Restoration"))!.date).toBe("2027-01-30");
  });
  it("detects procedural fairness letters", () => {
    const r = analyzeRefusal({ text: "This is a procedural fairness letter. Before a final decision is made on your application, you have 30 days to respond to the concerns set out below regarding the authenticity of your employment letter submitted with the application.", notifiedOn: "2026-11-15" }, on);
    expect(r.flags.map((f) => f.key)).toContain("procedural_fairness");
    expect(r.deadlines.find((d) => d.title.startsWith("Response"))!.date).toBe("2026-12-15");
  });
  it("admits when it can't find reasons", () => {
    const r = analyzeRefusal({ text: "Dear applicant, we have reviewed your file and completed our assessment of everything you sent to our office. A decision letter with further information will follow from the office that processed it." }, on);
    expect(r.grounds).toHaveLength(0);
    expect(r.needsProfessional).toBe(true);
    expect(r.notes.join(" ")).toMatch(/couldn't find the reasons/);
  });
});

describe("refusal analysis precision", () => {
  const pgwp = `Your application for a post-graduation work permit has been refused. I am not satisfied that you meet the requirements.
Your program of study was not eligible and your language test results do not meet the minimum required.
If you are in Canada you must leave Canada by the end of the period authorized for your stay.`;
  it("doesn't mistake an instruction to leave, or a PGWP program, for study permit grounds", () => {
    const keys = analyzeRefusal({ text: pgwp }, on).grounds.map((g) => g.key);
    expect(keys).not.toContain("leave_end_of_stay");
    expect(keys).not.toContain("study_plan");
    expect(keys).toEqual(expect.arrayContaining(["eligibility", "language"]));
  });
});
