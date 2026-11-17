import { currentUser } from "@/lib/auth";
import { loadProfile } from "@/lib/profile/store";
import { languageFromTest, statusCheck, TEMP_SOURCES, type Credential, type PgwpInput } from "@/lib/engine/temporary";
import { minClb } from "@/lib/engine/language";
import { TemporaryTools } from "@/components/TemporaryTools";
import { SRC } from "@/lib/sources";

export const metadata = { title: "Work permits and temporary status", description: "Check PGWP, spousal and bridging work permit eligibility, and understand visas, permits, maintained status and restoration." };

const terms: Array<[string, string, string]> = [
  ["Visitor visa (temporary resident visa)", "A sticker in your passport showing you meet the requirements to travel to Canada. Visa-exempt travellers flying in use an electronic travel authorization (eTA) instead. Neither lets you work or study.", "https://www.canada.ca/en/immigration-refugees-citizenship/services/visit-canada/visitor-visa.html"],
  ["Visitor record", "A document that extends your stay as a visitor. IRCC is clear that a visitor record is not a visa.", "https://www.canada.ca/en/immigration-refugees-citizenship/services/visit-canada/extend-stay.html"],
  ["Temporary resident status", "Your legal right to be in Canada for a limited time, as a visitor, student or worker. It ends on the date set by your permit or visitor record.", TEMP_SOURCES.extendWork],
  ["Study permit", "Lets you study at a designated learning institution. It usually lasts the length of your program plus 90 days.", "https://www.canada.ca/en/immigration-refugees-citizenship/services/study-canada/extend-study-permit.html"],
  ["Work permit", "Lets you work in Canada. An employer-specific permit names one employer, and most of those jobs need a labour market impact assessment (LMIA) proving a foreign worker is needed. An open permit, like a PGWP, lets you work for most employers.", "https://www.canada.ca/en/immigration-refugees-citizenship/services/work-canada/employer-specific.html"],
  ["Maintained status", "If you apply to extend or change your status before it expires, you can stay under the same conditions while IRCC decides (IRPR s. 183(5) and (6)). Apply even one day late and it doesn't apply.", TEMP_SOURCES.extendWork],
  ["Restoration of status", "If your status has expired, you may be able to apply to restore it within 90 days (IRPR s. 182). You normally can't work or study while you wait.", TEMP_SOURCES.restoreWork],
  ["Permanent residence", "The right to live, work and study anywhere in Canada with no end date. It isn't citizenship.", SRC.expressEntry],
];

function credentialFrom(type?: string): Credential | undefined {
  if (type === "bachelors") return "bachelors";
  if (type === "masters") return "masters";
  if (type === "doctoral") return "doctoral";
  if (type === "certificate" || type === "diploma" || type === "advanced_diploma" || type === "postgrad_certificate") return "college";
  return undefined;
}

export default async function WorkPermitsPage({ searchParams }: { searchParams: Promise<{ tool?: string }> }) {
  const { tool: t } = await searchParams;
  const tool = t === "spouse" || t === "bowp" ? t : "pgwp";
  const user = await currentUser();
  const today = new Date().toISOString().slice(0, 10);
  const profile = user ? (await loadProfile(user.id)).profile : {};
  const en = languageFromTest(profile.englishTest);
  const fr = languageFromTest(profile.frenchTest);
  const language = en && fr ? (minClb(en) >= minClb(fr) ? en : fr) : en ?? fr;
  const pgwp: PgwpInput = {
    credential: credentialFrom(profile.canadianCredentialType),
    programMonths: profile.canadianProgramLengthMonths,
    fullTimeEachTerm: profile.canadianStudyFullTime,
    completionConfirmedOn: profile.canadianGraduationDate || undefined,
    hadPgwpBefore: profile.status === "pgwp" ? "yes" : undefined,
    language,
  };
  const advice = user ? statusCheck(profile.status, profile.permitExpiryDate, profile.statusExpiredDate, new Date()) : [];

  return (
    <div className="container app-main">
      <header className="page-head">
        <h1>Work permits and temporary status</h1>
        <p>Check whether you may qualify for the permits international graduates and workers ask about most, using IRCC&apos;s current rules. Your status comes first: permanent residence usually takes longer than a permit lasts.</p>
      </header>

      {advice.length > 0 && (
        <section className="stock panel" style={{ marginBottom: "var(--space-2xl)" }} aria-labelledby="st-h">
          <h2 id="st-h">Your status right now</h2>
          <ul className="list small">
            {advice.map((a) => (
              <li key={a.title}>
                <div className="row"><strong style={{ fontWeight: 500 }}>{a.title}</strong>{a.urgent && <span className="tag tag--urgent">Act soon</span>}</div>
                <span className="muted">{a.detail}</span>
                <a href={a.url} target="_blank" rel="noopener noreferrer">Official page</a>
              </li>
            ))}
          </ul>
        </section>
      )}

      <TemporaryTools tool={tool} pgwp={pgwp} today={today} />

      <section className="honesty" style={{ marginTop: "var(--space-3xl)" }} aria-labelledby="terms-h">
        <h2 id="terms-h" className="sect-h">The words, explained</h2>
        <dl className="prose">
          {terms.map(([term, def, url]) => (
            <div key={term}>
              <dt>{term}</dt>
              <dd>{def} <a href={url} target="_blank" rel="noopener noreferrer">IRCC</a></dd>
            </div>
          ))}
        </dl>
      </section>
    </div>
  );
}
