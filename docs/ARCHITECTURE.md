# PRPath Canada: architecture

Your Canadian Immigration Journey, Simplified.

This document is the design that came before the code. Phase 1 is built to it. Later phases are planned here but not built yet, and the sections say so.

PRPath Canada gives immigration information and decision support. It is not an authorized representative (RCIC or lawyer), it never submits applications, and it never promises an outcome.

---

## 1. Product architecture

```
                       ┌─────────────────────────────────────────────┐
  Browser (mobile,     │  Next.js App Router (TypeScript)            │
  tablet, desktop) ───▶│  ├─ Public pages: home, CRS calculator,     │
                       │  │   pathway/work-permit/refusal/update     │
                       │  │   explainers, legal                      │
                       │  ├─ Account pages (session required):       │
                       │  │   dashboard, assessment, history, profile│
                       │  └─ Server Actions + Route Handlers         │
                       └──────────────┬──────────────────────────────┘
                                      │ (server only)
          ┌───────────────────────────┼─────────────────────────────────┐
          ▼                           ▼                                 ▼
  ┌───────────────┐        ┌─────────────────────┐          ┌────────────────────┐
  │ Auth service  │        │ Rule engine (pure TS│          │ Data access layer   │
  │ scrypt hashes │        │ no I/O, no LLM)     │          │ Prisma, every query │
  │ DB sessions   │        │ ├─ language → CLB   │          │ scoped by userId    │
  │ reset tokens  │        │ ├─ CRS (versioned)  │          │ AES-256-GCM on the  │
  │ rate limits   │        │ ├─ eligibility (P2) │          │ profile payload     │
  └───────┬───────┘        │ └─ recommendations  │          └─────────┬──────────┘
          │                │     (P2)            │                    │
          └────────────────┴──────────┬──────────┴────────────────────┘
                                      ▼
                             PostgreSQL (one database)
                                      │
            Later phases ─────────────┼──────────────────────────────────────
            P3  Document store (object storage, per-user keys, malware scan)
            P3  Extraction + refusal analysis (LLM, never scores, never decides)
            P4  Source monitor (scheduled fetch of official pages → review queue)
            P4  Notification worker (email for deadlines)
```

Boundaries that do not move:

- **Numbers come from the rule engine.** CRS points, CLB levels and eligibility verdicts are computed by deterministic code from versioned tables. An LLM may explain a result in plain words; it never produces one.
- **Rules carry their source.** Every rule set has an official URL, an effective date and the date someone last checked it.
- **Users only see their own rows.** All personal data is read through functions that take the session's `userId`; there is no query path that takes a user id from the request.

## 2. Technology stack

| Concern | Choice | Why |
| --- | --- | --- |
| Web framework | Next.js 16 (App Router), React 19, TypeScript (strict) | one codebase for pages, server actions and API; server components keep secrets server side |
| Styling | Hand-written CSS with design tokens (`app/tokens.css`) | small, auditable, no runtime; tokens make a future design system port easy |
| Database | PostgreSQL 16 | relational data, JSONB for versioned rule payloads, row-level security available later |
| ORM / migrations | Prisma 6 | typed queries, migration history in git |
| Auth | Own session auth: scrypt password hashes (Node `crypto`), random 256-bit session tokens stored as SHA-256 hashes, `HttpOnly; Secure; SameSite=Lax` cookie | no third party holds immigration data; easy to swap for an auth provider later |
| Validation | Zod 4 | every server action validates its input |
| Tests | Vitest | rule engine is pure functions, tested without a database |
| Encryption | AES-256-GCM (Node `crypto`) with a key from `APP_ENCRYPTION_KEY` | profile answers are encrypted at rest; key lives in the host's secret store |
| Email | Pluggable mailer (`lib/mail.ts`); logs in development | production adds an SMTP/API provider without code changes elsewhere |
| AI (Phase 3+) | Claude API for document extraction and plain-language explanations | always behind the rule engine, with consent and a human-review flag |
| Hosting | Any Node host with managed Postgres in a Canadian region (e.g. Vercel + a Canadian Postgres, or AWS ca-central-1) | data residency in Canada simplifies PIPEDA and provincial expectations |

## 3. Database schema

Implemented in `prisma/schema.prisma` (Phase 1 tables) with later-phase tables designed below.

**Phase 1 (built)**

| Table | Purpose | Key columns |
| --- | --- | --- |
| `User` | account | `email` (unique, lower case), `passwordHash`, `name`, `consentAt`, `consentVersion`, `deletedAt` |
| `Session` | login sessions | `tokenHash` (unique), `userId`, `expiresAt`, `ip`, `userAgent` |
| `PasswordResetToken` | recovery | `tokenHash`, `userId`, `expiresAt` (30 min), `usedAt` |
| `LoginAttempt` | brute-force throttling | `email`, `ip`, `success`, `createdAt` |
| `Profile` | the questionnaire answers | `userId` (unique), `ciphertext` (AES-GCM of the JSON answers), `completedSteps`, `schemaVersion` |
| `Assessment` | a frozen run of the engine | `userId`, `ruleSetVersion`, `inputSnapshot` (encrypted), `result` (JSON breakdown), `total`, `createdAt` |
| `Scenario` | saved what-if CRS inputs | `userId`, `name`, `ruleSetVersion`, `input` (encrypted), `total` |
| `Deadline` | expiry reminders | `userId`, `kind`, `title`, `dueDate`, `source` (`profile` or `user`), `dismissedAt` |
| `RuleSet` | registry of rule versions | `key` (e.g. `crs`), `version` (e.g. `2026-11-03`), `effectiveFrom`, `effectiveTo`, `sourceUrl`, `verifiedAt`, `notes` |
| `AuditLog` | security-relevant events | `userId`, `action`, `ip`, `createdAt` |

**Later phases (designed, not built)**

| Table | Purpose |
| --- | --- |
| `Program` | one row per pathway (CEC, FSW, FST, each PNP stream, AIP, RCIP, FCIP, sponsorships, Quebec) with `jurisdiction`, `category` |
| `ProgramVersion` | versioned requirements: `status` (open, closed, paused, suspended, not accepting, announced), `effectiveDate`, `verifiedAt`, `sourceUrl`, `requirements` (JSONB for the engine), `previousVersionId` |
| `Occupation` | NOC 2021 v1.0: code, title, TEER, lead statement, main duties, example titles; plus `HighWageLevel` per IRCC list with its effective date |
| `SourceSnapshot` | fetched official page, hash, fetchedAt; diff against the last snapshot feeds a review queue |
| `UpdateItem` | human-reviewed news entry: `kind` (draw, category change, stream status, fee, processing time), `announcedAt`, `effectiveAt`, `status` (announced vs in effect) |
| `Document` | user upload: object key, per-file data key wrapped by KMS, `docType`, `extracted` (JSON), `expiresOn`, `consentAt`, `deletedAt` |
| `RefusalAnalysis` | extracted reasons, flags (misrepresentation, inadmissibility, PFL, status loss), deadlines found, `needsProfessional` |
| `Milestone` | application tracker items per saved pathway |

## 4. User journey

1. **Arrive** on the home page and pick one of six doors: start an assessment, calculate CRS, explore PR pathways, check work permit options, analyze a refusal letter, read updates.
2. **Try the CRS calculator without an account.** Nothing is stored. The result says which rule version scored it and links the official criteria.
3. **Create an account** to save. Registration asks for consent to store immigration data, with the privacy policy linked.
4. **Complete the assessment** in short steps: about you, status in Canada, education, language, work, where you'd live. Each step saves as you go. Questions appear only if they apply (a PGWP holder is asked about the PGWP; a student about the study permit and program).
5. **See the dashboard**: current status and permit expiry countdown, CRS score with its breakdown, what is missing from the profile, deadlines, next steps, and pathways (Phase 2).
6. **Try what-ifs**: better test scores, another year of Canadian work, French results, a nomination. Save and compare scenarios side by side.
7. **Come back** to history: every assessment is frozen with the rule version it used, so an old score can be explained even after IRCC changes the rules.

## 5. Main application pages

| Route | Phase | What it does |
| --- | --- | --- |
| `/` | 1 | the six doors, plain-language promise, disclaimer |
| `/signup`, `/login`, `/forgot-password`, `/reset-password` | 1 | account access |
| `/dashboard` | 1 | status, CRS, deadlines, missing information, next steps |
| `/assessment` | 1 | dynamic multi-step questionnaire with autosave |
| `/crs` | 1 | calculator, breakdown with reasons, scenarios and comparison |
| `/history` | 1 | frozen assessments with rule versions |
| `/account` | 1 | profile, password change, data export, account deletion |
| `/pathways` | 2 | program database and personal matches (Phase 1 shows official links and the plan) |
| `/work-permits` | 3 | temporary status module (Phase 1 explains the key terms and links official pages) |
| `/refusal` | 3 | refusal letter analysis (Phase 1 explains urgent deadlines and when to get help) |
| `/updates` | 4 | official update centre (Phase 1 links official sources only) |
| `/privacy`, `/terms`, `/disclaimer` | 1 | legal pages |

## 6. Immigration rule engine architecture

```
lib/engine/
  language.ts        test score → CLB/NCLC per ability, per test, versioned tables
  crs/
    types.ts         CrsInput (normalized, test-agnostic) and CrsResult
    rules-2025-03-25.ts   archived rule table (job offer points removed)
    rules-2026-11-03.ts   current rule table (Labour Market Integration factor)
    calculate.ts     calculate(input, ruleSet) → CrsResult (pure)
    registry.ts      pick rule set by date; list versions
  profile-to-crs.ts  maps saved questionnaire answers to CrsInput, listing what is missing
```

Principles:

- **Pure and deterministic.** `calculate()` has no I/O, no clock, no randomness. Same input and rule set, same output, every time.
- **Data, not code, for points.** Point tables live in a rule-set object with `version`, `effectiveFrom`, `sourceUrl`, `verifiedAt`. The calculator reads the table; a new IRCC change is a new file plus tests, never an edit to an old one.
- **Explain every line.** Each factor returns `{ points, max, explanation }` and the explanation names the input that produced it (for example "CLB 9 in reading → 31 points, single applicant").
- **No double counting.** Each sub-factor has a cap. Skill transferability caps each group at 50 and the whole section at 100. The Labour Market Integration factor takes the higher of Canadian work points or job offer points, never both. Spouse factors only apply when the spouse is coming to Canada and is not a Canadian citizen or PR.
- **Eligibility is separate from score.** A CRS score says nothing about whether someone qualifies for CEC, FSW or FST. Phase 2 adds `eligibility/` modules that return `eligible`, `likely`, `not_eligible` or `needs_information` with reasons.
- **Assessments freeze their inputs.** A saved assessment stores the input snapshot, the rule version and the output, so it can be audited later.
- **Unknowns are reported, not guessed.** If the user has not told us something needed to score a factor, the factor scores 0 and the result lists it as missing.

## 7. Data update strategy

- **Source of truth:** canada.ca (IRCC, ESDC) and each province's official immigration site. Consultancy blogs are never a source.
- **Rule versions:** every rule set and, in Phase 2, every program record carries `sourceUrl`, `verifiedAt`, `effectiveFrom`, `effectiveTo`, `status`, and a link to the previous version.
- **Announced is not in effect.** Records have both `announcedAt` and `effectiveAt`; the engine only uses versions whose effective date has passed and whose status is verified.
- **Monitoring (Phase 4):** a scheduled job fetches each official page, stores a snapshot and a content hash, and opens a review item when the hash changes. A person reviews the diff, updates the record, and the change ships with tests. Nothing auto-publishes.
- **Staleness:** any record not verified in 30 days shows a warning to users; 90 days hides confidence badges.

## 8. Security architecture

- **Authentication:** scrypt (N=16384, r=8, p=1, 64-byte key, 16-byte salt) with constant-time comparison; minimum 10-character passwords; sessions are random 32-byte tokens, only the SHA-256 hash is stored; 30-day sliding expiry; logout deletes the row; password change and reset revoke all sessions.
- **Recovery:** single-use reset tokens, hashed, 30-minute expiry; the request form answers the same way whether or not the email exists.
- **Throttling:** failed logins are counted per email and per IP over 15 minutes; past the limit, login is refused for that window.
- **Authorization:** every data function takes the `userId` from the session, never from input. Assessment, scenario and deadline lookups filter by both `id` and `userId`.
- **Encryption:** TLS in transit; questionnaire answers and scenario inputs encrypted with AES-256-GCM before they reach the database (key from `APP_ENCRYPTION_KEY`, rotated via a key id prefix). Phase 3 documents get per-file data keys wrapped by a KMS key.
- **Web protections:** Server Actions check the Origin header; cookies are `HttpOnly`, `SameSite=Lax`, `Secure` in production; security headers (CSP, `X-Frame-Options: DENY`, `Referrer-Policy`, `Permissions-Policy`) set in `next.config.ts`.
- **Privacy (PIPEDA and provincial laws):** consent recorded with version and time; purpose limited to the assessment; data export and account deletion from the account page; deletion removes profile, assessments, scenarios, deadlines and sessions immediately (documents in Phase 3 are crypto-shredded by destroying their key); audit log for sign-ins, resets, exports and deletions; retention: inactive accounts flagged after 24 months.
- **AI boundaries:** the model never submits, signs, or speaks as the applicant; uploaded documents are only processed after explicit consent per upload.

## 9. Development roadmap

| Phase | Scope | Status |
| --- | --- | --- |
| 1 | Architecture, schema, auth, dashboard, dynamic questionnaire, CRS calculator with versioned rules, scenarios, history, legal pages | **built** |
| 2 | Express Entry eligibility (CEC, FSW 67-point grid, FST), category-based selection checks, NOC 2021 database and duty matching, provincial stream database with statuses, recommendation ranking and action plan | **built** |
| 3 | RCIP, FCIP, AIP and other community pathways; work permit and temporary status assessment (PGWP length, BOWP, SOWP, restoration windows); document upload, extraction and checklists; refusal analysis with professional-review flags | **built** |
| 4 | Official source monitoring and review queue, update centre, email notifications, AI assistant for explanations | planned |
| 5 | Penetration test, rule validation against IRCC's own tool, load testing, production deployment in a Canadian region | planned |

### Phase 2: what was built and how it was verified

- `lib/engine/eligibility/`: CEC, FSW (minimums and the 67-point grid), FST, and the ten current category-based selection categories. Rules and occupation lists read from canada.ca on 2026-11-17 (program pages dated 2026-10-16 and 2026-11-03).
- `lib/data/noc-2021.json`: all 516 NOC 2021 V1.0 unit groups with lead statements, main duties, examples, requirements and exclusions, built by `scripts/build-noc.py` from Statistics Canada's official CSV files.
- `lib/engine/noc/match.ts`: BM25 ranking of the person's own duty description against each unit group's lead statement and main duties. Job titles are never used for ranking, only to warn when a title points elsewhere. Every official duty is marked matched, partly matched or not mentioned. Descriptions under 25 words are refused.
- `lib/data/programs.ts`: provincial, territorial, community and other pathways, each with the status its official page states, a short quote, the URL and the check date.
- `lib/engine/recommend.ts`: deterministic ranking into potential, worth checking and not right now, using requirement verdicts, program status, where the person lives or would live, job offer, permit expiry and categories; plus a dated action plan.

### Phase 3: what was built and how it was verified

- **Documents** (`lib/documents/`, `app/api/documents/`): uploads need per-file consent; type is decided by the file's bytes (PDF, PNG, JPEG only), 10 MB and 60-file limits, same-origin check. Each file is encrypted with its own AES-256-GCM key, wrapped by the app key; deleting the row destroys the key. Text-based PDFs are read with pdf.js; scans and photos are stored but not read (no OCR yet). Field suggestions come from deterministic patterns and are never written to the profile without the person clicking to copy them.
- **Checks and checklists**: expired and expiring documents, permit dates and test scores that differ from the profile, reference letters missing hours, salary, duties or a signature block, letters whose hours or start date differ from the job entered. Checklists are built per pathway from the person's own jobs, education and status.
- **Refusal analysis** (`lib/engine/refusal.ts`): application type, grounds matched to IRPA and IRPR provisions verified on the Justice Laws site (current to 2026-10-29), judicial review deadlines (IRPA s. 72(2)(b): 15 days in Canada, 60 outside), restoration windows (IRPR s. 182), procedural fairness responses, and flags for misrepresentation, criminality, security, human rights, health, non-compliance and loss of status that require professional review. Options are listed, labelled as legal challenge or administrative step, and never ranked as advice.
- **Optional AI explanation** (`lib/ai/explain.ts`): Claude (`claude-opus-5-5`, server-side fallbacks on) explains the officer's concerns in plain language only when the operator sets `PRPATH_AI=on` and the person ticks a separate consent box. It is told not to give deadlines, legal references or recommendations; those always come from the rules.
- **Temporary status** (`lib/engine/temporary.ts`): PGWP eligibility and length (language since November 1, 2024, field of study, 180-day window, one per lifetime), spousal open work permits (January 21, 2025 rules), bridging open work permits, and a status check for maintained status, restoration and permit expiry.

### Known gaps in program data (2026-11-17)

- **Not verified:** Manitoba, Nova Scotia, Prince Edward Island and Yukon block automated reading or were unavailable. They are listed as "Not verified" with their official URL.
- **Ontario:** only the OINP landing page could be read: the Ontario Workforce Priority stream has launched and all other streams are closed. The new stream's requirements are not recorded.
- **Quebec:** program names only; statuses not stated on the listing page.
- **Status not stated:** many provincial stream pages give no intake status. They are labelled that way rather than assumed open.
- Provincial streams are listed for people to check; their detailed eligibility is not assessed yet.

### Known limitations in Phase 3

- No OCR: scanned PDFs and photos are stored but their text isn't read.
- Visitor restoration and leaving Canada on maintained status were not on the pages read; the app links to IRCC rather than stating rules.
- Bridging permit timing (how close to expiry you can apply) wasn't stated on the page read, so the app doesn't state it.
- The AI explanation is off by default and was not exercised here, because no API credentials are configured in this environment.

### Known limitations in Phase 1

- **High-wage occupations.** Since November 3, 2026, CRS awards points for high-wage Canadian experience and high-wage job offers based on IRCC's list of NOC codes and wage levels. Phase 1 asks the user which level IRCC's list gives their occupation and links the list; it does not look the code up itself. Phase 2 imports the list with its effective date.
- **Validation cases** are built by hand from the official tables. They should be cross-checked against IRCC's own CRS tool before launch.
- **Email** is logged to the server console in development until a mail provider is configured.
