import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { checkDocuments } from "@/lib/documents/checks";
import { checklistFor } from "@/lib/documents/checklist";
import { listDocuments } from "@/lib/documents/store";
import { DOC_TYPES } from "@/lib/documents/types";
import { loadProfile } from "@/lib/profile/store";
import { DocumentUpload } from "@/components/DocumentUpload";
import { DocumentItem } from "@/components/DocumentItem";

export const metadata = { title: "Documents" };

const PATHWAYS: Array<[string, string]> = [
  ["cec", "Canadian Experience Class"],
  ["fsw", "Federal Skilled Worker"],
  ["fst", "Federal Skilled Trades"],
  ["community", "Atlantic or rural community programs"],
];

export default async function DocumentsPage({ searchParams }: { searchParams: Promise<{ pathway?: string }> }) {
  const user = await requireUser();
  const { pathway: pick } = await searchParams;
  const pathway = PATHWAYS.some(([k]) => k === pick) ? pick! : "cec";
  const now = new Date();
  const [docs, { profile }] = await Promise.all([listDocuments(user.id), loadProfile(user.id)]);
  const findings = checkDocuments(docs, profile, now);
  const checklist = checklistFor(pathway, profile, docs, now);
  const problems = findings.filter((f) => f.level === "problem").length;

  return (
    <div className="container app-main">
      <header className="page-head">
        <h1>Your documents</h1>
        <p>Stored encrypted, each file with its own key, readable only from your account. We read the text to check dates and details against your profile; we never change your documents.</p>
      </header>

      <div className="dash">
        <div className="dash__col">
          <DocumentUpload />
          <section aria-labelledby="docs-h">
            <h2 id="docs-h" className="sect-h">Uploaded <span className="muted fig">{docs.length}</span></h2>
            <p className="small muted sect-p">
              {docs.length ? (problems ? `${problems} problem${problems === 1 ? "" : "s"} to fix. Open a document to see details.` : "Open a document to check what we read and confirm its dates.") : "Nothing uploaded yet. Start with your passport, permit and language test results."}
            </p>
            <div className="recs">
              {docs.map((d) => <DocumentItem key={d.id} doc={d} findings={findings.filter((f) => f.docId === d.id)} />)}
            </div>
          </section>
        </div>

        <aside className="dash__col">
          <section className="stock panel" aria-labelledby="cl-h">
            <h2 id="cl-h">Checklist</h2>
            <nav className="choices" aria-label="Checklist pathway" style={{ marginBottom: "var(--space-md)" }}>
              {PATHWAYS.map(([k, label]) => (
                <Link key={k} href={`/documents?pathway=${k}`} className="choice" aria-current={k === pathway ? "page" : undefined}>
                  <span>{label}</span>
                </Link>
              ))}
            </nav>
            <p className="small muted" style={{ marginBottom: "var(--space-sm)" }}>
              {checklist.complete} of {checklist.items.length} ready. Built from your answers; IRCC&apos;s own document checklist when you apply is the final word.
            </p>
            <ul className="list small">
              {checklist.items.map((i) => (
                <li key={i.key}>
                  <div className="row">
                    <strong style={{ fontWeight: 500 }}>{i.label}</strong>
                    <span className={i.state === "have" ? "tag" : i.state === "expired" ? "tag tag--urgent" : "tag tag--soon"}>{i.state === "have" ? "Ready" : i.state === "expired" ? "Expired" : "Missing"}</span>
                  </div>
                  <span className="muted">{i.why}</span>
                </li>
              ))}
            </ul>
          </section>
          <p className="small muted">
            Types we accept: {Object.values(DOC_TYPES).map((t) => t.label.toLowerCase()).join(", ")}. For a refusal letter, use the <Link href="/refusal">refusal analysis</Link> instead.
          </p>
        </aside>
      </div>
    </div>
  );
}
