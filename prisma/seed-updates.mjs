// Seeds updates verified against official pages on 2026-11-17. Idempotent by title.
import { PrismaClient } from "@prisma/client";
const db = new PrismaClient();
const d = (s) => (s ? new Date(s + "T00:00:00Z") : null);
const items = [
  { kind: "crs", title: "CRS changes: labour market integration factor and job offers without an LMIA", summary: "Since November 3, 2026, CRS gives points for either Canadian work experience (with extra points for high-wage occupations) or a qualifying high-wage job offer, whichever is higher. Job offers no longer need an LMIA. Invitation rounds paused while IRCC recalculated profiles.", jurisdiction: "Federal", sourceUrl: "https://www.canada.ca/en/immigration-refugees-citizenship/services/immigrate-canada/express-entry/changes.html", effectiveOn: "2026-11-03", status: "in_effect" },
  { kind: "stream_status", title: "Ontario launches the Ontario Workforce Priority stream and closes all other OINP streams", summary: "Ontario's OINP page says the new Ontario Workforce Priority stream has launched and all other streams are now closed, with more changes coming.", jurisdiction: "Ontario", sourceUrl: "https://www.ontario.ca/page/ontario-immigrant-nominee-program-oinp", effectiveOn: null, status: "in_effect" },
  { kind: "community", title: "Rural Community Immigration Pilot closes; permanent Rural Community Immigration Program opens", summary: "IRCC says the Rural Community Immigration Pilot will close as of January 1, 2027, and the permanent Rural Community Immigration Program opens the same day. Pilot recommendations dated December 31, 2026 or earlier must be used before they expire.", jurisdiction: "Federal", sourceUrl: "https://www.canada.ca/en/immigration-refugees-citizenship/services/immigrate-canada/rural-franco-pilots/rural-immigration-program.html", effectiveOn: "2027-01-01", status: "announced" },
  { kind: "stream_status", title: "BC PNP Entry Level and Semi Skilled stream closed", summary: "The BC PNP says the Entry Level and Semi Skilled (ELSS) stream is officially closed.", jurisdiction: "British Columbia", sourceUrl: "https://www.welcomebc.ca/immigrate-to-b-c/about-the-bc-provincial-nominee-program/news", effectiveOn: null, status: "ended" },
];
for (const it of items) {
  const exists = await db.updateItem.findFirst({ where: { title: it.title } });
  if (exists) continue;
  await db.updateItem.create({ data: { ...it, effectiveOn: d(it.effectiveOn), announcedOn: null, publishedBy: "seed: verified 2026-11-17" } });
  console.log("seeded:", it.title);
}
await db.$disconnect();
