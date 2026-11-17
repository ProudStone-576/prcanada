import { z } from "zod";

/**
 * The questionnaire answers. Every field is optional so a profile can be saved
 * one step at a time. "Unknown" is a valid answer and is reported as missing
 * information, never guessed.
 */

const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use the date picker").optional().or(z.literal(""));
const text = (max = 200) => z.string().trim().max(max).optional();
const yesNo = z.enum(["yes", "no", "unsure"]).optional();

export const TEST_TYPES = ["ielts_gt", "celpip_g", "pte_core", "tef_canada", "tcf_canada"] as const;

export const languageTestSchema = z.object({
  type: z.enum(TEST_TYPES),
  date: date,
  listening: z.coerce.number().min(0).max(699),
  reading: z.coerce.number().min(0).max(699),
  writing: z.coerce.number().min(0).max(699),
  speaking: z.coerce.number().min(0).max(699),
});
export type LanguageTest = z.infer<typeof languageTestSchema>;

export const EDUCATION_LEVELS = [
  "less_than_secondary",
  "secondary",
  "one_year",
  "two_year",
  "bachelors_or_three_year",
  "two_or_more",
  "masters_or_professional",
  "doctoral",
] as const;

export const STATUSES = [
  "student",
  "pgwp",
  "closed_work_permit",
  "open_work_permit",
  "visitor",
  "maintained",
  "out_of_status",
  "refugee_claimant",
  "outside_canada",
  "other",
] as const;
export type StatusKind = (typeof STATUSES)[number];

export const STATUS_LABELS: Record<StatusKind, string> = {
  student: "International student (study permit)",
  pgwp: "Post-graduation work permit (PGWP)",
  closed_work_permit: "Employer-specific (closed) work permit",
  open_work_permit: "Other open work permit (for example spousal or bridging)",
  visitor: "Visitor",
  maintained: "Maintained status (applied to extend before my permit expired)",
  out_of_status: "My status has expired and I have not applied to extend",
  refugee_claimant: "Refugee claimant",
  outside_canada: "I live outside Canada",
  other: "Something else",
};

export const TEERS = ["0", "1", "2", "3", "4", "5", "unknown"] as const;
export const HIGH_WAGE = ["none", "x1_3", "x1_5", "x2"] as const;

export const jobSchema = z.object({
  id: z.string().max(40),
  title: text(120),
  employer: text(160),
  country: z.enum(["canada", "foreign"]),
  province: text(60),
  startDate: date,
  endDate: date,
  current: z.boolean().optional(),
  hoursPerWeek: z.coerce.number().min(0).max(100).optional(),
  paid: z.boolean().optional(),
  selfEmployed: z.boolean().optional(),
  whileFullTimeStudent: z.boolean().optional(),
  teer: z.enum(TEERS).optional(),
  nocCode: z.string().regex(/^\d{5}$/, "NOC 2021 codes have 5 digits").optional().or(z.literal("")),
  highWage: z.enum(HIGH_WAGE).optional(),
  duties: text(4000),
  hasReferenceLetter: yesNo,
});
export type Job = z.infer<typeof jobSchema>;

export const profileSchema = z.object({
  // About you
  firstName: text(80),
  dateOfBirth: date,
  nationality: text(80),
  countryOfResidence: text(80),
  maritalStatus: z.enum(["single", "married", "common_law", "separated", "divorced", "widowed"]).optional(),
  spouseIsCitizenOrPr: yesNo,
  spouseAccompanying: yesNo,
  spouseEducation: z.enum(EDUCATION_LEVELS).optional(),
  spouseCanadianWorkYears: z.coerce.number().min(0).max(40).optional(),
  spouseTest: languageTestSchema.optional().nullable(),
  children: z.coerce.number().int().min(0).max(20).optional(),
  siblingInCanada: yesNo,
  relativesInCanada: text(400),

  // Status in Canada
  status: z.enum(STATUSES).optional(),
  arrivalDate: date,
  permitIssueDate: date,
  permitExpiryDate: date,
  maintainedAppliedDate: date,
  maintainedAppliedFor: text(160),
  statusExpiredDate: date,
  studyInstitution: text(160),
  studyDliNumber: z.string().trim().regex(/^(O\d{11})?$/i, "DLI numbers look like O19395677352").optional(),
  studyProgram: text(160),
  studyExpectedGraduation: date,
  pgwpProgramLengthMonths: z.coerce.number().min(0).max(120).optional(),
  closedPermitEmployer: text(160),
  closedPermitLmia: yesNo,
  previousPermits: text(1000),
  previousRefusals: yesNo,
  previousRefusalsDetails: text(1000),
  previousRestoration: yesNo,
  previousViolations: yesNo,
  previousViolationsDetails: text(1000),
  previousApplications: text(1000),

  // Education
  educationLevel: z.enum(EDUCATION_LEVELS).optional(),
  educationEarnedIn: z.enum(["canada", "foreign", "both"]).optional(),
  ecaStatus: z.enum(["none", "in_progress", "completed"]).optional(),
  ecaEquivalent: z.enum(EDUCATION_LEVELS).optional(),
  ecaDate: date,
  canadianInstitution: text(160),
  canadianInstitutionIsDli: yesNo,
  canadianProgram: text(160),
  canadianCredentialType: z.enum(["certificate", "diploma", "advanced_diploma", "bachelors", "postgrad_certificate", "masters", "doctoral", "other"]).optional(),
  canadianProgramLengthMonths: z.coerce.number().min(0).max(120).optional(),
  canadianGraduationDate: date,
  canadianStudyFullTime: yesNo,
  canadianStudyInPerson: yesNo,
  certificateOfQualification: yesNo,

  // Language
  englishTest: languageTestSchema.optional().nullable(),
  frenchTest: languageTestSchema.optional().nullable(),

  // Work
  jobs: z.array(jobSchema).max(20).optional(),
  jobOfferHighWage: z.enum(HIGH_WAGE).optional(),

  // Where you'd live
  province: text(60),
  city: text(100),
  willingToRelocate: yesNo,
  preferredProvinces: z.array(z.string().max(60)).max(14).optional(),
  ruralOk: yesNo,
  learnFrench: yesNo,
  provincialNomination: yesNo,
});

export type Profile = z.infer<typeof profileSchema>;

export const STEPS = [
  { key: "about", label: "About you" },
  { key: "status", label: "Status in Canada" },
  { key: "education", label: "Education" },
  { key: "language", label: "Language tests" },
  { key: "work", label: "Work" },
  { key: "location", label: "Where you'd live" },
] as const;
export type StepKey = (typeof STEPS)[number]["key"];

export const PROVINCES = [
  "Alberta",
  "British Columbia",
  "Manitoba",
  "New Brunswick",
  "Newfoundland and Labrador",
  "Northwest Territories",
  "Nova Scotia",
  "Nunavut",
  "Ontario",
  "Prince Edward Island",
  "Quebec",
  "Saskatchewan",
  "Yukon",
];
