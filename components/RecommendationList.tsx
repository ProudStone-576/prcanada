import type { Recommendation } from "@/lib/engine/recommend";
import { STATUS_LABEL } from "@/lib/data/programs";

const VERDICT_LABEL = { meets: "Met", not_met: "Not met", needs_info: "Need to know" } as const;

export function RecommendationList({ items, open = false }: { items: Recommendation[]; open?: boolean }) {
  return (
    <div className="recs">
      {items.map((r, i) => (
        <details key={r.id} className="stock panel rec" open={open && i === 0}>
          <summary className="rec__sum">
            <span className="rec__name">{r.name}</span>
            <span className="small muted">{r.jurisdiction}</span>
            <span className={r.status === "closing" || r.status === "not_verified" ? "tag tag--soon" : "tag"}>{STATUS_LABEL[r.status]}</span>
          </summary>
          <div className="rec__body">
            {r.reasons.length > 0 && (
              <div>
                <h3 className="rec__h">Why it&apos;s here</h3>
                <ul className="small">{r.reasons.map((x) => <li key={x}>{x}</li>)}</ul>
              </div>
            )}
            {r.requirements && (
              <table className="ledger">
                <caption className="visually-hidden">Requirements for {r.name}</caption>
                <thead>
                  <tr><th scope="col">Requirement</th><th scope="col">You</th></tr>
                </thead>
                <tbody>
                  {r.requirements.map((q) => (
                    <tr key={q.key}>
                      <td>
                        {q.label}
                        {q.detail && <p className="why">{q.detail}</p>}
                      </td>
                      <td className={q.verdict === "meets" ? "delta-up" : q.verdict === "not_met" ? "delta-down" : ""} style={{ whiteSpace: "nowrap" }}>{VERDICT_LABEL[q.verdict]}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            {!r.requirements && r.gaps.length > 0 && (
              <div>
                <h3 className="rec__h">To check</h3>
                <ul className="small">{r.gaps.map((x) => <li key={x}>{x}</li>)}</ul>
              </div>
            )}
            {r.extra?.categories && (
              <div>
                <h3 className="rec__h">Express Entry category rounds</h3>
                <ul className="small">
                  {r.extra.categories.filter((c) => c.verdict !== "not_met").map((c) => (
                    <li key={c.key}><strong style={{ fontWeight: 500 }}>{c.name}:</strong> {c.verdict === "meets" ? "you may qualify." : "need more information."} {c.detail}</li>
                  ))}
                  {r.extra.categories.every((c) => c.verdict === "not_met") && <li>None of the current categories matches your answers.</li>}
                </ul>
              </div>
            )}
            <p className="small muted">{r.statusNote}</p>
            {r.checkedOnly.length > 0 && <ul className="small muted">{r.checkedOnly.map((x) => <li key={x}>{x}</li>)}</ul>}
            {r.documents.length > 0 && (
              <div>
                <h3 className="rec__h">Documents you&apos;ll typically need</h3>
                <ul className="small">{r.documents.map((x) => <li key={x}>{x}</li>)}</ul>
              </div>
            )}
            <p className="small">
              <a href={r.url} target="_blank" rel="noopener noreferrer">Official page</a> <span className="muted">checked {r.verifiedAt}</span>
            </p>
          </div>
        </details>
      ))}
    </div>
  );
}
