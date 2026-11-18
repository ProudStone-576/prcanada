# PRPath Canada

Your Canadian Immigration Journey, Simplified.

A Canadian immigration decision-support platform for international students, graduates and temporary residents. **Phases 1 to 4** are built: accounts, a dynamic assessment, a dashboard, a CRS calculator worked from IRCC's official tables (including the November 3, 2026 changes), Express Entry eligibility checks (CEC, FSW, FST and current categories), a NOC finder that compares your duties with the official NOC 2021 descriptions, a database of provincial and community programs with their official statuses, ranked pathway recommendations with an action plan, encrypted document storage with checks and checklists, refusal letter analysis with deadlines, work permit assessments (PGWP, spousal, bridging), official-page monitoring with a human review queue, an update centre, deadline reminders (in-app, opt-in email), and an optional grounded AI assistant.

PRPath Canada gives information, not legal advice. It is not a licensed consultant or lawyer and never submits applications.

- Architecture, schema, security and roadmap: [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md)
- Rule engine: [`lib/engine`](lib/engine) (pure TypeScript, no LLM, tested in [`tests`](tests))

## Run it

Requires Node 22+ and PostgreSQL 16.

```bash
cp .env.example .env          # set DATABASE_URL and APP_ENCRYPTION_KEY
npm install
npx prisma migrate deploy
npm run dev                   # http://localhost:3000
npm test                      # engine and profile tests
```

Schedule `POST /api/cron/monitor` and `POST /api/cron/notify` daily with `Authorization: Bearer $CRON_SECRET`, and list reviewers in `REVIEWER_EMAILS` (see `.env.example`).

Set `PRPATH_AI=on` (with Anthropic credentials) to offer optional AI explanations of refusal letters; it's off by default.

Password reset emails are written to the server log until a mail provider is configured in `lib/mail.ts`.

## What's in Phase 1

| Area | Where |
| --- | --- |
| Sign up, sign in, sign out, password reset, throttling | `app/actions/auth.ts`, `lib/auth.ts` |
| Six-step dynamic assessment, encrypted at rest | `components/AssessmentForm.tsx`, `lib/profile/` |
| Dashboard: status, CRS, deadlines, missing info, next steps | `app/dashboard/page.tsx` |
| CRS calculator, what-ifs, saved scenarios, comparison | `components/CrsCalculator.tsx` |
| Frozen history with rule versions | `app/history/` |
| Data export and account deletion | `app/api/export/route.ts`, `app/account/` |
| Disclaimer, privacy policy, terms | `app/disclaimer`, `app/privacy`, `app/terms` |

## Known limitations

- **High-wage occupations** (new CRS points since Nov 3, 2026): the user picks their occupation's level from IRCC's list; the list itself is not imported yet.
- **Provincial data gaps:** Manitoba, Nova Scotia, PEI and Yukon couldn't be read automatically and are marked "Not verified"; Ontario's new stream requirements aren't recorded. See `docs/ARCHITECTURE.md`.
- Provincial streams are listed for people to check, not assessed in detail. Document and refusal analysis, and update monitoring, are later phases.
- Rebuild the NOC data with `python3 scripts/build-noc.py <structure.csv> <elements.csv> <date>` from Statistics Canada's files.
- Test cases are hand-worked from the official tables; cross-check against IRCC's own CRS tool before launch.
