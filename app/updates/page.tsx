import { SRC } from "@/lib/sources";
import { CRS_RULE_SETS } from "@/lib/engine/crs/rules";
import { db } from "@/lib/db";
import { KIND_LABEL, type UpdateKind } from "@/lib/updates";

export const metadata = { title: "Immigration updates", description: "Immigration changes reviewed against official sources, with announced and in-effect dates kept separate." };

const fmt = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : null);

export default async function UpdatesPage() {
  const [updates, lastCheck] = await Promise.all([
    db.updateItem.findMany({ orderBy: { publishedAt: "desc" }, take: 60 }),
    db.sourceWatch.findFirst({ where: { lastFetchedAt: { not: null } }, orderBy: { lastFetchedAt: "desc" }, select: { lastFetchedAt: true } }),
  ]);
  const inEffect = updates.filter((u) => u.status === "in_effect");
  const announced = updates.filter((u) => u.status === "announced");
  const ended = updates.filter((u) => u.status === "ended");

  const list = (items: typeof updates, label: (u: (typeof updates)[number]) => string) =>
    items.length === 0 ? (
      <p className="small muted">None right now.</p>
    ) : (
      <ul className="list">
        {items.map((u) => (
          <li key={u.id}>
            <div className="row">
              <strong style={{ fontWeight: 500 }}>{u.title}</strong>
              <span className="tag">{KIND_LABEL[u.kind as UpdateKind] ?? u.kind}</span>
            </div>
            <span className="small">{u.summary}</span>
            <span className="small muted">
              {u.jurisdiction}. {label(u)} Reviewed {fmt(u.publishedAt)}. <a href={u.sourceUrl} target="_blank" rel="noopener noreferrer">Official source</a>
            </span>
          </li>
        ))}
      </ul>
    );

  return (
    <div className="container app-main">
      <header className="page-head">
        <h1>Immigration updates</h1>
        <p>
          We watch the official pages our rules rely on. When one changes, a person reviews it against the source before anything appears here. An announcement is never treated as policy until it takes effect.
          {lastCheck?.lastFetchedAt ? ` Pages last checked ${fmt(lastCheck.lastFetchedAt)}.` : ""}
        </p>
      </header>

      <div className="dash">
        <div className="dash__col">
          <section className="stock panel" aria-labelledby="ie-h">
            <h2 id="ie-h">In effect</h2>
            {list(inEffect, (u) => (u.effectiveOn ? `In effect since ${fmt(u.effectiveOn)}.` : "In effect."))}
          </section>
          <section className="stock panel" aria-labelledby="an-h">
            <h2 id="an-h">Announced, not yet in effect</h2>
            {list(announced, (u) => (u.effectiveOn ? `Takes effect ${fmt(u.effectiveOn)}, if implemented as announced.` : "No effective date announced."))}
          </section>
          {ended.length > 0 && (
            <section className="stock panel" aria-labelledby="en-h">
              <h2 id="en-h">Ended or closed</h2>
              {list(ended, (u) => (u.effectiveOn ? `Ended ${fmt(u.effectiveOn)}.` : "Ended."))}
            </section>
          )}
        </div>
        <aside className="dash__col">
          <section className="stock panel" aria-labelledby="rules-h">
            <h2 id="rules-h">Rules this site uses</h2>
            <table className="ledger">
              <caption className="visually-hidden">Rule versions applied in PRPath Canada</caption>
              <thead><tr><th scope="col">Effective</th><th scope="col">Rule</th></tr></thead>
              <tbody>
                {CRS_RULE_SETS.map((r) => (
                  <tr key={r.version}>
                    <td className="fig" style={{ whiteSpace: "nowrap" }}>{r.effectiveFrom}</td>
                    <td>CRS: {r.summary} <a href={r.version === "2026-11-03" ? SRC.crsChanges : r.sourceUrl} target="_blank" rel="noopener noreferrer">Source</a></td>
                  </tr>
                ))}
                <tr>
                  <td className="fig" style={{ whiteSpace: "nowrap" }}>2026-10-29</td>
                  <td>Immigration and Refugee Protection Act and Regulations, for refusal analysis. <a href="https://laws-lois.justice.gc.ca/eng/acts/i-2.5/" target="_blank" rel="noopener noreferrer">Source</a></td>
                </tr>
                <tr>
                  <td className="fig" style={{ whiteSpace: "nowrap" }}>2026-10-16</td>
                  <td>Language test equivalency charts. <a href={SRC.languageTests} target="_blank" rel="noopener noreferrer">Source</a></td>
                </tr>
              </tbody>
            </table>
          </section>
          <section className="stock panel" aria-labelledby="feeds-h">
            <h2 id="feeds-h">Official feeds</h2>
            <ul className="list small">
              <li><a href={SRC.news} target="_blank" rel="noopener noreferrer">IRCC newsroom</a></li>
              <li><a href={SRC.rounds} target="_blank" rel="noopener noreferrer">Express Entry rounds of invitations</a></li>
              <li><a href={SRC.processingTimes} target="_blank" rel="noopener noreferrer">Processing times</a></li>
              <li><a href={SRC.pnp} target="_blank" rel="noopener noreferrer">Provincial nominee programs</a></li>
            </ul>
          </section>
        </aside>
      </div>
    </div>
  );
}
