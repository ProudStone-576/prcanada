import type { CrsResult } from "@/lib/engine/crs/types";

/** The full points breakdown with the reason for every line. */
export function Breakdown({ result, caption }: { result: CrsResult; caption?: string }) {
  return (
    <table className="ledger">
      {caption && <caption className="visually-hidden">{caption}</caption>}
      <thead>
        <tr>
          <th scope="col">Factor</th>
          <th scope="col" className="num">Points</th>
          <th scope="col" className="num">Max</th>
        </tr>
      </thead>
      {result.sections.map((s) => (
        <tbody key={s.key}>
          <tr className="sect-row">
            <th scope="rowgroup">{s.label}</th>
            <td className="num">{s.points}</td>
            <td className="num muted">{s.max}</td>
          </tr>
          {s.lines.map((l) => (
            <tr key={l.key}>
              <td>
                {l.label}
                <p className="why">{l.explanation}</p>
              </td>
              <td className="num">{l.points}</td>
              <td className="num muted">{l.max}</td>
            </tr>
          ))}
        </tbody>
      ))}
      <tfoot>
        <tr>
          <th scope="row">Total</th>
          <td className="num">{result.total}</td>
          <td className="num muted">{result.sections.reduce((t, s) => t + s.max, 0)}</td>
        </tr>
      </tfoot>
    </table>
  );
}
