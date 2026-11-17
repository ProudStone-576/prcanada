import { currentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { decryptJson } from "@/lib/crypto";
import { aiEnabled } from "@/lib/ai/explain";
import { listDocuments } from "@/lib/documents/store";
import { APP_LABEL, LAW_VERIFIED, type RefusalResult } from "@/lib/engine/refusal";
import { RefusalAnalyzer, RefusalReport } from "@/components/RefusalAnalyzer";
import { SRC } from "@/lib/sources";
import { deleteRefusalAction } from "@/app/actions/refusal";

export const metadata = { title: "Refusal letter analysis", description: "Understand an immigration refusal: the officer's concerns, the law cited, your deadlines and your options." };

export default async function RefusalPage() {
  const user = await currentUser();
  const letters = user
    ? (await listDocuments(user.id)).filter((d) => d.docType === "refusal_letter" && d.meta.text).map((d) => ({ id: d.id, label: `${d.meta.filename} (added ${d.createdAt})` }))
    : [];
  const past = user ? await db.refusalAnalysis.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" }, take: 20 }) : [];

  return (
    <div className="container app-main">
      <header className="page-head">
        <h1>Understand your refusal letter</h1>
        <p>
          We read the letter for what was refused, the officer&apos;s reasons and the law behind them, then work out your deadlines and set out your options. Legal references are checked against the{" "}
          <a href="https://laws-lois.justice.gc.ca/eng/acts/i-2.5/" target="_blank" rel="noopener noreferrer">Act</a> and{" "}
          <a href="https://laws-lois.justice.gc.ca/eng/regulations/SOR-2002-227/" target="_blank" rel="noopener noreferrer">Regulations</a> as of {LAW_VERIFIED}. This is information, not legal advice.
        </p>
      </header>

      <p className="notice notice--error" style={{ marginBottom: "var(--space-xl)" }}>
        <strong>Some deadlines are short.</strong> To ask the Federal Court to review a decision you generally have 15 days if it was made in Canada and 60 days if made outside Canada, from when you were told. If your status has ended, restoration has a 90-day limit. Talk to a lawyer or{" "}
        <a href={SRC.cicc} target="_blank" rel="noopener noreferrer">licensed consultant</a> early.
      </p>

      <RefusalAnalyzer signedIn={Boolean(user)} aiAvailable={aiEnabled()} letters={letters} />

      {past.length > 0 && (
        <section style={{ marginTop: "var(--space-3xl)" }} aria-labelledby="past-h">
          <h2 id="past-h" className="sect-h">Saved analyses</h2>
          <div className="recs" style={{ maxWidth: 900 }}>
            {past.map((row) => {
              const data = decryptJson<{ result: RefusalResult; ai: null }>(row.cipher);
              return (
                <details key={row.id} className="stock panel rec">
                  <summary className="rec__sum">
                    <span className="rec__name">{APP_LABEL[data.result.appType]}</span>
                    <span className="small muted">Analyzed {row.createdAt.toISOString().slice(0, 10)}</span>
                    {data.result.needsProfessional && <span className="tag tag--urgent">Professional review</span>}
                  </summary>
                  <div className="rec__body">
                    <RefusalReport result={data.result} ai={data.ai} />
                    <form action={async () => { "use server"; await deleteRefusalAction(row.id); }}>
                      <button type="submit" className="linklike small">Delete this analysis</button>
                    </form>
                  </div>
                </details>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}
