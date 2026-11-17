import Link from "next/link";
import { currentUser } from "@/lib/auth";
import { loadProfile } from "@/lib/profile/store";
import { recommend } from "@/lib/engine/recommend";
import { PROGRAMS, STATUS_LABEL } from "@/lib/data/programs";
import { RecommendationList } from "@/components/RecommendationList";
import { Term } from "@/components/Term";

export const metadata = {
  title: "PR pathways",
  description: "Permanent residence programs matched to your situation, with each requirement checked, plus every program's official status and source.",
};

const ORDER = ["Federal", "Federal, with New Brunswick, Newfoundland and Labrador, Nova Scotia and Prince Edward Island", "Alberta", "British Columbia", "Manitoba", "New Brunswick", "Newfoundland and Labrador", "Northwest Territories", "Nova Scotia", "Nunavut", "Ontario", "Prince Edward Island", "Quebec", "Saskatchewan", "Yukon"];

export default async function PathwaysPage() {
  const user = await currentUser();
  const now = new Date();
  let report: ReturnType<typeof recommend> | null = null;
  let hasProfile = false;
  if (user) {
    const { profile, completedSteps } = await loadProfile(user.id);
    hasProfile = completedSteps.length > 0;
    if (hasProfile) report = recommend(profile, now);
  }
  const groups = ORDER.map((j) => ({ j, items: PROGRAMS.filter((p) => p.jurisdiction === j) })).filter((g) => g.items.length);

  return (
    <div className="container app-main">
      <header className="page-head">
        <h1>Permanent residence pathways</h1>
        <p>
          {report
            ? "Ranked for you from your assessment: whether you meet each requirement we can check, whether the program is open, and where you'd live. Not a decision; every result links to its official source."
            : "Every program we track, with its status as its official page states it. Complete the assessment to see which fit you."}
        </p>
      </header>

      {!report && (
        <div className="stock panel empty" style={{ marginBottom: "var(--space-2xl)" }}>
          <h2>See which pathways fit you</h2>
          <p>We check your answers against each program&apos;s requirements and explain what&apos;s met, missing and unknown.</p>
          <Link href={user ? "/assessment" : "/signup"} className="btn btn--ink">{user ? "Continue your assessment" : "Start your assessment"}</Link>
        </div>
      )}

      {report && (
        <>
          {report.flags.length > 0 && (
            <p className="notice" style={{ marginBottom: "var(--space-xl)" }}>
              <strong>Get professional advice first.</strong> {report.flags.join(" ")}{" "}
              <a href="https://college-ic.ca/protecting-the-public/find-an-immigration-consultant" target="_blank" rel="noopener noreferrer">Find a licensed consultant</a>.
            </p>
          )}
          <div className="dash" style={{ marginBottom: "var(--space-3xl)" }}>
            <div className="dash__col">
              <section aria-labelledby="pot-h">
                <h2 id="pot-h" className="sect-h">Potential pathways <span className="muted fig">{report.potential.length}</span></h2>
                <p className="small muted sect-p">You meet every requirement we can check from your answers. Others, like employers or officers, still decide the rest.</p>
                {report.potential.length ? <RecommendationList items={report.potential} open /> : <p className="empty">None yet. The plan on the right shows what would change that.</p>}
              </section>
              <section aria-labelledby="ni-h">
                <h2 id="ni-h" className="sect-h">Worth checking <span className="muted fig">{report.needsInfo.length}</span></h2>
                <p className="small muted sect-p">We need more information, the program decides by invitation, or we can&apos;t assess its details yet.</p>
                <RecommendationList items={report.needsInfo} />
              </section>
              <section aria-labelledby="nn-h">
                <h2 id="nn-h" className="sect-h">Not right now <span className="muted fig">{report.notNow.length}</span></h2>
                <p className="small muted sect-p">You don&apos;t meet at least one requirement today. The reasons show what would need to change.</p>
                <RecommendationList items={report.notNow} />
              </section>
            </div>
            <aside className="dash__col">
              <section className="stock panel" aria-labelledby="plan-h">
                <h2 id="plan-h">Your action plan</h2>
                {report.plan.length ? (
                  <ol className="list plan">
                    {report.plan.map((m) => (
                      <li key={m.title}>
                        <div className="row">
                          <strong style={{ fontWeight: 500 }}>{m.title}</strong>
                          {m.priority === "now" && <span className="tag tag--urgent">Now</span>}
                        </div>
                        <span className="small muted">{m.detail}</span>
                        {m.due && <span className="small">Target date: <span className="fig">{m.due}</span></span>}
                        {m.href && (m.href.startsWith("/") ? <Link className="small" href={m.href}>Open</Link> : <a className="small" href={m.href} target="_blank" rel="noopener noreferrer">Official page</a>)}
                      </li>
                    ))}
                  </ol>
                ) : (
                  <p className="small muted">Nothing urgent. Keep your answers up to date.</p>
                )}
              </section>
              <p className="small muted">
                Processing times change often, so we don&apos;t estimate them. Check{" "}
                <a href="https://www.canada.ca/en/immigration-refugees-citizenship/services/application/check-processing-times.html" target="_blank" rel="noopener noreferrer">IRCC&apos;s current processing times</a>.
              </p>
            </aside>
          </div>
        </>
      )}

      <section aria-labelledby="db-h">
        <h2 id="db-h" className="sect-h">Every program we track</h2>
        <p className="small muted sect-p" style={{ maxWidth: "70ch" }}>
          Statuses are copied from each official page on the date shown. &quot;Status not stated&quot; means the page gives none. &quot;Not verified&quot; means we couldn&apos;t read the official site; check it directly. For <Term k="express_entry">Express Entry</Term> programs, see your results above or the <Link href="/crs">CRS calculator</Link>.
        </p>
        <div className="compare">
          <table className="ledger db">
            <caption className="visually-hidden">Program status database</caption>
            <thead>
              <tr>
                <th scope="col">Program</th>
                <th scope="col">Where</th>
                <th scope="col">Status</th>
                <th scope="col">Checked</th>
              </tr>
            </thead>
            {groups.map((g) => (
              <tbody key={g.j}>
                {g.items.map((p) => (
                  <tr key={p.id}>
                    <td>
                      <a href={p.url} target="_blank" rel="noopener noreferrer">{p.name}</a>
                      <p className="why">{p.statusNote}</p>
                    </td>
                    <td>{p.jurisdiction.startsWith("Federal, with") ? "Atlantic provinces" : p.jurisdiction}</td>
                    <td style={{ whiteSpace: "nowrap" }}>{STATUS_LABEL[p.status]}</td>
                    <td className="fig small">{p.verifiedAt}</td>
                  </tr>
                ))}
              </tbody>
            ))}
          </table>
        </div>
      </section>
    </div>
  );
}
