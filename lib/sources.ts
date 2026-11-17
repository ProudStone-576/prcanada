/** Official pages the platform links and checks against. Each URL was opened and confirmed on `verifiedAt`. */
export const VERIFIED_AT = "2026-11-17";

const IRCC = "https://www.canada.ca/en/immigration-refugees-citizenship";

export const SRC = {
  expressEntry: `${IRCC}/services/immigrate-canada/express-entry.html`,
  crsCriteria: `${IRCC}/services/immigrate-canada/express-entry/check-score/crs-criteria.html`,
  crsChanges: `${IRCC}/services/immigrate-canada/express-entry/changes.html`,
  highWage: `${IRCC}/services/immigrate-canada/express-entry/check-score/high-wage.html`,
  languageTests: `${IRCC}/services/immigrate-canada/express-entry/documents/language-test.html`,
  rounds: `${IRCC}/corporate/mandate/policies-operational-instructions-agreements/ministerial-instructions/express-entry-rounds.html`,
  pnp: `${IRCC}/services/immigrate-canada/provincial-nominees.html`,
  workCanada: `${IRCC}/services/work-canada.html`,
  pgwp: `${IRCC}/services/study-canada/work/after-graduation.html`,
  processingTimes: `${IRCC}/services/application/check-processing-times.html`,
  news: `${IRCC}/news.html`,
  noc: "https://noc.esdc.gc.ca/",
  quebec: "https://www.quebec.ca/en/immigration",
  atlantic: `${IRCC}/services/immigrate-canada/atlantic-immigration.html`,
  family: `${IRCC}/services/immigrate-canada/family-sponsorship.html`,
  representative: `${IRCC}/services/immigration-citizenship-representative.html`,
  restore: `${IRCC}/services/work-canada/restore.html`,
  eca: `${IRCC}/services/immigrate-canada/express-entry/documents/education-assessed.html`,
  eeEligibility: `${IRCC}/services/immigrate-canada/express-entry/eligibility.html`,
  studyPermit: `${IRCC}/services/study-canada/study-permit.html`,
  ruralFranco: `${IRCC}/services/immigrate-canada/rural-franco-pilots.html`,
  refugeeInCanada: `${IRCC}/services/refugees/claim-protection-inside-canada.html`,
  vulnerableWorkers: `${IRCC}/services/work-canada/permit/temporary/vulnerable-workers.html`,
  irccAccount: `${IRCC}/services/application/account.html`,
  cicc: "https://college-ic.ca/protecting-the-public/find-an-immigration-consultant",
};

export const OFFICIAL = [
  { label: "Express Entry (IRCC)", url: SRC.expressEntry },
  { label: "CRS criteria", url: SRC.crsCriteria },
  { label: "Provincial Nominee Program", url: SRC.pnp },
  { label: "Post-graduation work permit", url: SRC.pgwp },
  { label: "National Occupational Classification (ESDC)", url: SRC.noc },
  { label: "Immigration to Quebec", url: SRC.quebec },
];
