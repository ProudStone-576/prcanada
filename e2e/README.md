# End-to-end and security suites

Browser tests against a running server, using Playwright (`npm i -D playwright` if it isn't installed globally).

```bash
npm run build && npx next start -p 3000 > server.log 2>&1 &   # or npm run dev
for f in e2e/fixtures/*.txt; do python3 e2e/mkpdf.py "$f" "${f%.txt}.pdf"; done
node e2e/fixture-server.cjs &          # a local page the monitor test can change
SERVER_LOG=server.log node e2e/01-core.cjs
node e2e/02-pathways.cjs
node e2e/03-documents-refusal.cjs
SERVER_LOG=server.log node e2e/04-monitoring-reminders.cjs   # needs REVIEWER_EMAILS="reviewer@example.com" and a watch for http://localhost:4555/program
node e2e/05-security.cjs
```

The security suite deliberately uses up the sign-up limit for your network, and all test traffic comes from one address, so clear the counters between suites in development: `DELETE FROM "RateEvent";`.

The suites create accounts ending in `@example.com`. Remove them afterwards in a development database: `DELETE FROM "User" WHERE email LIKE '%@example.com';`.

| Suite | Checks |
| --- | --- |
| 01-core | sign-up, the six-step assessment, dashboard CRS, history, another user can't see your records, no sideways scroll on phones |
| 02-pathways | NOC finder, NOC suggestions in the assessment, pathway ranking |
| 03-documents-refusal | upload consent, file-type sniffing, extraction and mismatch checks, owner-only downloads, cross-site upload refusal, refusal deadlines, data export |
| 04-monitoring-reminders | reviewer-only queue, diff display, "in effect" date rule, update centre, alerts, reminder idempotency, email only after opt-in |
| 05-security | nonce CSP and headers, signed-out redirects, cron secret, cookie flags, hashed sessions, open-redirect attempts, reset and sign-up rate limits |
