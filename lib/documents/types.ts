/** Document types the platform accepts, and how long each is valid where IRCC sets a rule. */
export const DOC_TYPES = {
  passport: { label: "Passport", hasExpiry: true },
  study_permit: { label: "Study permit", hasExpiry: true },
  work_permit: { label: "Work permit", hasExpiry: true },
  visitor_record: { label: "Visitor record", hasExpiry: true },
  diploma: { label: "Diploma or degree", hasExpiry: false },
  transcript: { label: "Transcript", hasExpiry: false },
  language_test: { label: "Language test results", hasExpiry: true },
  employment_letter: { label: "Employment reference letter", hasExpiry: false },
  pay_slip: { label: "Pay slip", hasExpiry: false },
  t4: { label: "T4 slip", hasExpiry: false },
  noa: { label: "Notice of Assessment", hasExpiry: false },
  eca: { label: "Educational Credential Assessment", hasExpiry: true },
  bank_letter: { label: "Bank letter (proof of funds)", hasExpiry: false },
  nomination_certificate: { label: "Provincial nomination certificate", hasExpiry: true },
  refusal_letter: { label: "Refusal letter", hasExpiry: false },
  other: { label: "Other", hasExpiry: false },
} as const;

export type DocType = keyof typeof DOC_TYPES;
export const DOC_TYPE_KEYS = Object.keys(DOC_TYPES) as DocType[];

export const MAX_BYTES = 10 * 1024 * 1024;
export const MAX_DOCS = 60;

export type Mime = "application/pdf" | "image/png" | "image/jpeg";

/** Identify a file by its first bytes, never by its name or the browser's claim. */
export function sniffMime(buf: Uint8Array): Mime | null {
  if (buf.length >= 5 && buf[0] === 0x25 && buf[1] === 0x50 && buf[2] === 0x44 && buf[3] === 0x46 && buf[4] === 0x2d) return "application/pdf";
  if (buf.length >= 8 && buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return "image/png";
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "image/jpeg";
  return null;
}

/** Everything about a document except its bytes. Stored encrypted. */
export interface DocMeta {
  filename: string;
  text: string | null;
  textStatus: "extracted" | "no_text" | "image" | "failed";
  suggested: ExtractedFields;
  confirmed: { issuedOn?: string; expiresOn?: string; note?: string };
}

export interface ExtractedFields {
  issuedOn?: string;
  expiresOn?: string;
  testDate?: string;
  testType?: string;
  scores?: { listening?: number; reading?: number; writing?: number; speaking?: number };
  employer?: string;
  jobTitle?: string;
  hoursPerWeek?: number;
  salary?: string;
  startDate?: string;
  endDate?: string;
  hasDuties?: boolean;
  mentionsSignature?: boolean;
  ecaLevel?: string;
  taxYear?: string;
  province?: string;
  notes: string[];
}
