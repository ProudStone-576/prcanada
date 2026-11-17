import type { NocMatch } from "@/lib/engine/noc/match";

const FIT = { matches: "Matches", partly: "Partly", not_mentioned: "Not mentioned" } as const;
const CONF = { strong: "Strong match", possible: "Possible match", weak: "Weak match" } as const;

export function NocResults({ result, onPick }: { result: NocMatch; onPick?: (code: string, teer: number) => void }) {
  if (!result.ok) return <p className="notice">{result.reason}</p>;
  return (
    <div className="form" style={{ gap: "var(--space-md)" }}>
      <p className="notice">
        <strong>{result.confidence ? CONF[result.confidence] : ""}.</strong> These are suggestions from your description, compared with the official {result.dataVersion} lead statements and main duties. Your NOC must fit the lead statement and most of the main duties of what you actually do. If you&apos;re unsure, or your job mixes several occupations, have a licensed professional confirm it.
      </p>
      {result.titleNote && <p className="notice">{result.titleNote}</p>}
      {result.candidates.map((c, i) => (
        <details key={c.code} className="stock panel" open={i === 0}>
          <summary className="noc-sum">
            <span className="fig">{c.code}</span>
            <span className="noc-title">{c.title}</span>
            <span className="tag">TEER {c.teer}</span>
            <span className="small muted">{Math.round(c.coverage * 100)}% of duties covered</span>
          </summary>
          <div className="form" style={{ gap: "var(--space-sm)", marginTop: "var(--space-md)" }}>
            <p className="small">{c.lead}</p>
            <table className="ledger">
              <caption className="visually-hidden">Main duties compared with your description</caption>
              <thead>
                <tr><th scope="col">Official main duty</th><th scope="col">Your description</th></tr>
              </thead>
              <tbody>
                {c.duties.map((d) => (
                  <tr key={d.text}>
                    <td>{d.text}</td>
                    <td className={d.fit === "matches" ? "delta-up" : d.fit === "partly" ? "" : "muted"} style={{ whiteSpace: "nowrap" }}>{FIT[d.fit]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {c.exclusions.length > 0 && (
              <div className="small">
                <p className="label">Not this group if your job is really:</p>
                <ul>{c.exclusions.slice(0, 6).map((e) => <li key={e}>{e}</li>)}</ul>
              </div>
            )}
            {c.requirements.length > 0 && (
              <div className="small">
                <p className="label">Usual employment requirements:</p>
                <ul>{c.requirements.slice(0, 4).map((e) => <li key={e}>{e}</li>)}</ul>
              </div>
            )}
            {onPick && (
              <div className="actions">
                <button type="button" className="btn btn--card btn--sm" onClick={() => onPick(c.code, c.teer)}>Use NOC {c.code}</button>
              </div>
            )}
          </div>
        </details>
      ))}
    </div>
  );
}
