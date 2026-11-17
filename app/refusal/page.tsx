import { SRC } from "@/lib/sources";

export const metadata = { title: "Refusal letters", description: "What to do first after an immigration refusal, and when to get professional help." };

export default function RefusalPage() {
  return (
    <div className="container app-main">
      <header className="page-head">
        <h1>Got a refusal letter?</h1>
        <p>Letter analysis is planned for a later release, with your consent before any upload. Until then, here is what matters in the first days.</p>
      </header>
      <div className="honesty">
        <div>
          <p className="notice notice--error">
            <strong>Time limits are short.</strong> To ask the Federal Court to review a decision made in Canada you generally have 15 days from when you were told; for a decision made outside Canada, 60 days. Speak to a lawyer straight away if you are considering this.
          </p>
        </div>
        <div className="prose">
          <h2>Before you do anything</h2>
          <ol>
            <li>Read the letter for the reasons the officer gave and any date by which you must leave Canada or respond.</li>
            <li>Check your status. A refusal of an extension can mean you are now out of status.</li>
            <li>Don&apos;t reapply straight away with the same documents. A new application should answer the officer&apos;s concerns, and sometimes a different route is better.</li>
          </ol>
          <h2>Possible routes</h2>
          <dl>
            <dt>A new application</dt>
            <dd>An administrative step: you apply again with stronger evidence. It does not challenge the first decision.</dd>
            <dt>A reconsideration request</dt>
            <dd>Asking the office to look again, usually for a clear error. Officers don&apos;t have to agree, and it doesn&apos;t stop other deadlines.</dd>
            <dt>Judicial review</dt>
            <dd>A legal challenge in the Federal Court, with strict deadlines. You need a lawyer.</dd>
            <dt>Restoration of status</dt>
            <dd>If your status has expired, an application within 90 days may restore it. <a href={SRC.restore} target="_blank" rel="noopener noreferrer">IRCC: restore your status</a></dd>
          </dl>
          <h2>Get professional help if the letter mentions</h2>
          <ul>
            <li>Misrepresentation, which can carry a five-year ban</li>
            <li>Inadmissibility for criminality, health, security or other reasons</li>
            <li>A procedural fairness letter you haven&apos;t answered</li>
            <li>Loss of status or an order to leave Canada</li>
          </ul>
          <p>
            Find an <a href={SRC.cicc} target="_blank" rel="noopener noreferrer">authorized immigration consultant</a>, or a lawyer through your provincial law society. IRCC explains <a href={SRC.representative} target="_blank" rel="noopener noreferrer">who may represent you</a>.
          </p>
        </div>
      </div>
    </div>
  );
}
