import { SRC } from "@/lib/sources";
import { CRS_RULE_SETS } from "@/lib/engine/crs/rules";

export const metadata = { title: "Immigration updates", description: "Changes PRPath Canada has verified and applied, with links to official sources." };

export default function UpdatesPage() {
  return (
    <div className="container app-main">
      <header className="page-head">
        <h1>Immigration updates</h1>
        <p>Only changes we have checked against an official source and that are in effect. Automatic monitoring of IRCC and provincial pages is planned; until then, use the official feeds below for news.</p>
      </header>
      <div className="honesty">
        <div className="prose">
          <h2>Official feeds</h2>
          <ul>
            <li><a href={SRC.news} target="_blank" rel="noopener noreferrer">IRCC newsroom</a></li>
            <li><a href={SRC.rounds} target="_blank" rel="noopener noreferrer">Express Entry rounds of invitations</a></li>
            <li><a href={SRC.processingTimes} target="_blank" rel="noopener noreferrer">Processing times</a></li>
            <li><a href={SRC.pnp} target="_blank" rel="noopener noreferrer">Provincial nominee programs</a></li>
          </ul>
        </div>
        <table className="ledger">
          <caption className="visually-hidden">Rule changes applied in PRPath Canada</caption>
          <thead>
            <tr>
              <th scope="col">Effective</th>
              <th scope="col">Change</th>
              <th scope="col">Checked</th>
            </tr>
          </thead>
          <tbody>
            {CRS_RULE_SETS.map((r) => (
              <tr key={r.version}>
                <td className="fig">{r.effectiveFrom}</td>
                <td>
                  {r.summary} <a href={r.version === "2026-11-03" ? SRC.crsChanges : r.sourceUrl} target="_blank" rel="noopener noreferrer">Source</a>
                </td>
                <td className="fig">{r.verifiedAt}</td>
              </tr>
            ))}
            <tr>
              <td>In effect</td>
              <td>Ontario: the Ontario Workforce Priority stream launched and all other OINP streams closed. <a href="https://www.ontario.ca/page/ontario-immigrant-nominee-program-oinp" target="_blank" rel="noopener noreferrer">Source</a></td>
              <td className="fig">2026-11-17</td>
            </tr>
            <tr>
              <td className="fig">2027-01-01</td>
              <td>The Rural Community Immigration Pilot closes and the permanent Rural Community Immigration Program opens (announced). <a href="https://www.canada.ca/en/immigration-refugees-citizenship/services/immigrate-canada/rural-franco-pilots/rural-immigration-program.html" target="_blank" rel="noopener noreferrer">Source</a></td>
              <td className="fig">2026-11-17</td>
            </tr>
            <tr>
              <td>Page dated <span className="fig">2026-10-16</span></td>
              <td>Language test equivalency charts used to convert scores to CLB and NCLC. <a href={SRC.languageTests} target="_blank" rel="noopener noreferrer">Source</a></td>
              <td className="fig">2026-11-17</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
