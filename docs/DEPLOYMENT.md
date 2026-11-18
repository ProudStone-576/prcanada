# Deploying PRPath Canada

PRPath Canada stores immigration histories, test results and identity documents, so treat it as a sensitive-data system: host the app and the database in Canada, keep secrets in your host's secret store, and back up the database encrypted.

## 1. What you need

| Piece | Requirement |
| --- | --- |
| App | Node 22, or the Docker image from `Dockerfile` (standalone Next.js server, runs as a non-root user, has a health check) |
| Database | PostgreSQL 16, in a Canadian region (for example AWS `ca-central-1`), TLS on, automatic encrypted backups |
| Email | A transactional email provider wired into `lib/mail.ts`. Until then, password reset and reminder emails are **not sent** in production (the app says so in its logs and never records them as sent). |
| Scheduler | Something that calls the two jobs daily (Vercel Cron, a server crontab, or a cloud scheduler) |

## 2. Environment variables

| Variable | Required | Notes |
| --- | --- | --- |
| `DATABASE_URL` | yes | Postgres connection string with `sslmode=require` |
| `APP_ENCRYPTION_KEY` | yes | 32 random bytes, base64. Encrypts profiles, scenarios, analyses and every document's key. **Losing it makes all encrypted data unreadable; leaking it exposes it.** Store it in a secret manager and back it up separately from the database. |
| `APP_URL` | yes | Public base URL, used in emails |
| `CRON_SECRET` | yes | 24+ random characters; the jobs require `Authorization: Bearer $CRON_SECRET` |
| `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY` | when running more than one instance | Base64 AES key shared by all instances so server actions work across them (see the Next.js self-hosting guide). Not needed on Vercel. |
| `REVIEWER_EMAILS` | for the review queue | Comma-separated reviewer accounts |
| `PRPATH_AI` | no | `on` to offer AI explanations and the assistant; also needs Anthropic credentials (for example `ANTHROPIC_API_KEY`) |
| `MAIL_PROVIDER` | once email is wired | Marks email as configured for `lib/mail.ts` |

Generate secrets with `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"`.

## 3. First deployment

```bash
npx prisma migrate deploy          # create tables
npm run db:seed-updates            # the four updates verified on 2026-11-17
```

Then schedule the jobs daily (times are examples, in UTC):

| Job | Call | Does |
| --- | --- | --- |
| Source monitor | `POST` or `GET /api/cron/monitor` | Checks official pages, queues changes for review. Stops within 200 s and resumes with unchecked pages next run. |
| Reminders and retention | `POST` or `GET /api/cron/notify` | Deadline reminders, opt-in email, prunes rate-limit counters, applies the 24-month retention rule |

Both need `Authorization: Bearer $CRON_SECRET`. On Vercel, `vercel.json` already schedules them and Vercel sends the header when `CRON_SECRET` is set.

## 4. Options

### Vercel
1. Create a Postgres database in a Canadian region with your provider of choice and set `DATABASE_URL`.
2. Import the repository, set the environment variables above, and deploy. `vercel.json` adds the two daily jobs.
3. Run `npx prisma migrate deploy` against the production database from your machine or CI, then the seed.
4. Choose a Canadian function region in the project settings if your plan offers one.

### Docker (any Canadian host)
```bash
docker build -t prpath .
docker build --target migrate -t prpath-migrate .
docker run --rm --env-file .env.production prpath-migrate          # migrations, then the verified-updates seed
docker run -d --name prpath --env-file .env.production -p 3000:3000 prpath
```
Docker's `--env-file` doesn't strip quotes, so write values without them (`KEY=value`). Put it behind a TLS-terminating reverse proxy that **appends** the client address to `X-Forwarded-For` (nginx: `proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;`). Rate limits trust only the last entry, which your proxy adds.

## 5. Before real users

- [ ] Wire an email provider in `lib/mail.ts` and test a password reset.
- [ ] Have a person enter the test profiles from `tests/crs.test.ts` into IRCC's own CRS tool and confirm the totals (see `docs/VALIDATION.md`).
- [ ] Add at least one reviewer and run the monitor once to save baselines; check which official pages it can't read from your host.
- [ ] Have privacy and terms text reviewed by a lawyer familiar with PIPEDA and the provinces you serve.
- [ ] If you'll let licensed consultants help users for a fee, build that as a separate workflow (see the architecture document).
- [ ] Set up database backups, log retention and an incident contact.

## 6. Operations

- **Health:** `GET /api/health` returns `{ ok: true }` when the database answers.
- **Logs:** the app never logs document contents, profile answers or AI conversations.
- **Rule changes:** when the monitor reports a change to a page the engine relies on, update the rule set or program record in code with tests, re-run `docs/VALIDATION.md`'s check, and publish an update from the review queue.
- **Key rotation:** encrypted values carry a key id (`k1`). To rotate `APP_ENCRYPTION_KEY`, add a second key id in `lib/crypto.ts`, re-encrypt in a migration script, then retire the old key.
