import { SRC } from "@/lib/sources";

export const metadata = { title: "Work permits and temporary status", description: "Plain-language explanations of visas, permits, maintained status and permanent residence." };

const terms: Array<[string, string]> = [
  ["Visa (temporary resident visa)", "A sticker in your passport that lets you travel to Canada and ask to enter. It is not permission to stay, work or study, and it can expire while you are lawfully in Canada."],
  ["Temporary resident status", "Your legal right to be in Canada for a limited time, as a visitor, student or worker. It has its own end date, usually the date on your permit or visitor record."],
  ["Study permit", "Lets you study at a designated learning institution. It sets conditions, such as where and whether you may work."],
  ["Work permit", "Lets you work in Canada. An employer-specific (closed) permit names one employer; an open permit, such as a PGWP, lets you work for most employers."],
  ["Maintained status", "If you apply to extend or change your status before it expires, you can usually stay under the same conditions until IRCC decides. Apply even one day late and this protection does not apply."],
  ["Permanent residence", "The right to live, work and study anywhere in Canada with no end date. It comes with a card and a residency obligation, and can lead to citizenship."],
];

export default function WorkPermitsPage() {
  return (
    <div className="container app-main">
      <header className="page-head">
        <h1>Work permits and temporary status</h1>
        <p>The assessment for PGWP length, bridging permits, spousal permits and restoration is planned. Here is what the key words mean, and where IRCC explains each option.</p>
      </header>
      <div className="honesty">
        <div>
          <p className="notice">
            <strong>If your status has already expired,</strong> act now: IRCC must receive a restoration application no more than 90 days after it expired.{" "}
            <a href={SRC.restore} target="_blank" rel="noopener noreferrer">IRCC: restore your status</a>
          </p>
        </div>
        <div className="prose">
          <dl>
            {terms.map(([t, d]) => (
              <div key={t}>
                <dt>{t}</dt>
                <dd>{d}</dd>
              </div>
            ))}
          </dl>
          <h2>Official pages</h2>
          <ul>
            <li><a href={SRC.workCanada} target="_blank" rel="noopener noreferrer">Work in Canada: all work permit types</a></li>
            <li><a href={SRC.pgwp} target="_blank" rel="noopener noreferrer">Post-graduation work permit</a></li>
            <li><a href={SRC.studyPermit} target="_blank" rel="noopener noreferrer">Study permit</a></li>
            <li><a href={SRC.vulnerableWorkers} target="_blank" rel="noopener noreferrer">Open work permit for vulnerable workers</a></li>
          </ul>
        </div>
      </div>
    </div>
  );
}
