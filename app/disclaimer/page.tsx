import { SRC } from "@/lib/sources";

export const metadata = { title: "Disclaimer" };

export default function Disclaimer() {
  return (
    <div className="container app-main prose">
      <h1 style={{ fontSize: "var(--text-3xl)", marginBottom: "var(--space-lg)" }}>Disclaimer</h1>
      <p>PRPath Canada provides general immigration information and decision-support tools. It is not legal advice.</p>
      <h2>Who we are not</h2>
      <p>
        PRPath Canada is not a licensed immigration consultant (RCIC), a lawyer, a Quebec notary or any other authorized representative, and is not part of or endorsed by the Government of Canada, IRCC or any province. We do not represent you, submit applications, sign declarations or speak to IRCC for you, and our software never will.
      </p>
      <h2>No guarantees</h2>
      <p>
        A CRS score or a pathway shown here is not a decision. Only IRCC, a province, or another authority can decide your application. Invitations, nominations and approvals are never guaranteed.
      </p>
      <h2>How we calculate</h2>
      <p>
        Scores are computed by fixed, tested rules from official tables, and each result names the rule version and its official source. Rules change; check the source and date shown before you rely on any result. Where we lack information, we say so instead of guessing.
      </p>
      <h2>When to get professional advice</h2>
      <p>
        Refusals, misrepresentation, inadmissibility, procedural fairness letters, loss of status, removal orders and court deadlines need a licensed professional. IRCC explains <a href={SRC.representative} target="_blank" rel="noopener noreferrer">who may represent you</a>, and you can <a href={SRC.cicc} target="_blank" rel="noopener noreferrer">look up a licensed consultant</a>.
      </p>
    </div>
  );
}
