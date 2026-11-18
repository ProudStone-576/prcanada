# Rule validation record

Every number the engine uses was compared, row by row, with the official page on the date below. Re-run this check whenever the source monitor reports a change to one of these pages, and before each release.

## 2026-11-18: independent row-by-row re-check

Method: the engine's tables were exported from code (not retyped) and compared with each official page by a reviewer that read the pages in full, including long pages read in parts so no table was summarized.

| Area | Official page (page date) | Result |
| --- | --- | --- |
| CRS: age, education, first and second language with caps, Canadian work, labour market integration factor and caps, spouse factors, skill transferability and caps, additional points | [CRS criteria](https://www.canada.ca/en/immigration-refugees-citizenship/services/immigrate-canada/express-entry/check-score/crs-criteria.html) (2026-11-03) | All match |
| Labour market integration: "the higher of" Canadian work points or job offer points | [Express Entry changes](https://www.canada.ca/en/immigration-refugees-citizenship/services/immigrate-canada/express-entry/changes.html) (2026-10-16): "You'll get the score that gives you the higher number of CRS points" | Matches |
| Language: IELTS General Training, CELPIP-General, PTE Core, TEF Canada (old-score equivalents), TCF Canada; CEC, FSW and FST minimums | [Language test results](https://www.canada.ca/en/immigration-refugees-citizenship/services/immigrate-canada/express-entry/documents/language-test.html) (2026-10-16) | All match |
| FSW: age, experience, language, arranged employment, pass mark 67 | [Federal Skilled Worker Program](https://www.canada.ca/en/immigration-refugees-citizenship/services/immigrate-canada/express-entry/eligibility/federal-skilled-workers.html) (2026-11-03) | All match |
| FSW education points | [Educational credential assessment](https://www.canada.ca/en/immigration-refugees-citizenship/services/immigrate-canada/express-entry/documents/education-assessed.html) (2026-10-16) | All match |
| Proof of funds | [Proof of funds](https://www.canada.ca/en/immigration-refugees-citizenship/services/immigrate-canada/express-entry/documents/proof-funds.html) (2026-10-16) | Match; the table is still labelled "Updated July 7, 2025" and the app says so |

### Corrections made from this check

- **Canadian education additional points.** The engine had given 30 points to any Canadian master's or doctoral degree and required full-time, in-person study of at least 8 months. Neither rule appears on any official page we could read; the criteria table lists only "credential one or two years" (15) and "credential three years or longer" (30). The engine now scores by length only and tells the person that IRCC may apply further conditions, pointing to IRCC's own CRS tool. A Canadian master's under 3 years now gets 15 points with an explanation, rather than an unsupported 30. The Ministerial Instructions page that may hold more detail returned 404.

### Not modelled, by design

- FSW second official language: used for points only (4 points at CLB 5 in all four), as on the page.
- Adaptability values were checked against the FSW page during the Phase 2 build (2026-11-17): spouse language 5, own Canadian study 5, spouse study 5, own Canadian work 10, spouse Canadian work 5, arranged employment 5, relative 5, capped at 10.

## Earlier verification

Program eligibility, categories, community pilots, provincial streams, temporary status rules and the Immigration and Refugee Protection Act and Regulations were verified on 2026-11-17; see `docs/ARCHITECTURE.md` for the pages and dates.

## Not yet done

- **IRCC's interactive CRS tool.** It can't be driven automatically from this environment. Before launch, a person should enter the current-rules test profiles in `tests/crs.test.ts` into IRCC's CRS tool (linked from the [Express Entry page](https://www.canada.ca/en/immigration-refugees-citizenship/services/immigrate-canada/express-entry.html)) and confirm the totals 432 and 661. The 617 case uses the archived 2025 rule set, which IRCC's tool no longer applies.
