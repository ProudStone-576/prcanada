# PRPath Canada

Your Canadian Immigration Journey, Simplified.

A Canadian immigration decision-support platform for international students, graduates and temporary residents. **Phase 1** is built: accounts, a dynamic assessment, a dashboard, and a CRS calculator worked from IRCC's official tables (including the November 3, 2026 changes) with scenarios and a versioned history.

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
- **Program eligibility** (CEC, FSW, FST), NOC matching, provincial streams, document and refusal analysis, and update monitoring are later phases. Their pages link official sources instead of guessing.
- Test cases are hand-worked from the official tables; cross-check against IRCC's own CRS tool before launch.
