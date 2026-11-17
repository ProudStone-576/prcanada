import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { calculateCrs } from "@/lib/engine/crs/calculate";
import { ruleSetFor } from "@/lib/engine/crs/rules";
import { daysUntil, deriveCrs, deriveDeadlines, professionalFlags } from "@/lib/profile/derive";
import { STATUS_LABELS, STEPS } from "@/lib/profile/schema";
import { loadProfile } from "@/lib/profile/store";
import { SRC } from "@/lib/sources";
import { Term } from "@/components/Term";
import { AddDeadline } from "@/components/AddDeadline";
import { dismissDeadlineAction } from "@/app/actions/deadlines";
import { recommend } from "@/lib/engine/recommend";
import { STATUS_LABEL } from "@/lib/data/programs";

export const metadata = { title: "Dashboard" };

const fmt = (iso: string) => new Date(iso + "T00:00:00Z").toLocaleDateString("en-CA", { year: "numeric", month: "long", day: "numeric", timeZone: "UTC" });

function inDays(n: number) {
  if (n < 0) return `${-n} days ago`;
  if (n === 0) return "today";
  if (n === 1) return "tomorrow";
  return `in ${n} days`;
}

export default async function Dashboard() {
  const user = await requireUser();
  const now = new Date();
  const [{ profile, completedSteps }, lastAssessment, userDeadlines] = await Promise.all([
    loadProfile(user.id),
    db.assessment.findFirst({ where: { userId: user.id }, orderBy: { createdAt: "desc" } }),
    db.deadline.findMany({ where: { userId: user.id, dismissedAt: null }, orderBy: { dueDate: "asc" } }),
  ]);

  const rules = ruleSetFor(now);
  const derived = deriveCrs(profile, now);
  const result = derived.input ? calculateCrs(derived.input, rules) : null;
  const flags = professionalFlags(profile);
  const deadlines = [
    ...deriveDeadlines(profile, now).map((d) => ({ ...d, id: null as string | null })),
    ...userDeadlines.map((d) => ({
      id: d.id,
      kind: d.kind,
      title: d.title,
      dueDate: d.dueDate.toISOString().slice(0, 10),
      detail: "",
      sourceUrl: "",
      urgent: daysUntil(d.dueDate.toISOString().slice(0, 10), now) <= 30,
    })),
  ].sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  const remainingSteps = STEPS.filter((s) => !completedSteps.includes(s.key));
  const expiry = profile.permitExpiryDate ? daysUntil(profile.permitExpiryDate, now) : null;

  const report = completedSteps.length === 0 ? null : recommend(profile, now);
  const nextSteps: Array<{ text: string; href: string; external?: boolean }> = [];
  if (flags.length) nextSteps.push({ text: "Talk to a licensed consultant or lawyer about your situation before you apply for anything.", href: SRC.cicc, external: true });
  if (remainingSteps.length) nextSteps.push({ text: `Finish your assessment: ${remainingSteps.map((s) => s.label.toLowerCase()).join(", ")}.`, href: `/assessment?step=${remainingSteps[0].key}` });
  if (!profile.englishTest && !profile.frenchTest) nextSteps.push({ text: "Book an approved English or French test. Express Entry needs one, and scores drive about a third of your CRS.", href: SRC.languageTests, external: true });
  if (profile.educationEarnedIn === "foreign" && profile.ecaStatus !== "completed") nextSteps.push({ text: "Order an Educational Credential Assessment so your foreign education earns points.", href: SRC.eca, external: true });
  if (expiry !== null && expiry <= 180 && expiry > 0) nextSteps.push({ text: `Your permit expires ${inDays(expiry)}. Decide now how you'll keep your status; applying before it expires matters.`, href: SRC.workCanada, external: true });
  if (result) nextSteps.push({ text: "Try what-if scenarios to see which change would raise your score most.", href: "/crs" });
  for (const m of report?.plan ?? []) {
    if (nextSteps.length >= 5) break;
    if (!nextSteps.some((n) => n.text.startsWith(m.title))) nextSteps.push({ text: `${m.title}${m.due ? ` (by ${m.due})` : ""}.`, href: m.href ?? "/pathways", external: Boolean(m.href && !m.href.startsWith("/")) });
  }

  const empty = completedSteps.length === 0;
  const topPaths = report ? [...report.potential, ...report.needsInfo].slice(0, 4) : [];

  return (
    <div className="container app-main">
      <header className="page-head">
        <h1>{user.name ? `${user.name}, here's where you stand` : "Here's where you stand"}</h1>
        <p>Based on what you&apos;ve told us{completedSteps.length ? "" : " so far"}, scored with the rules in effect today.</p>
      </header>

      {empty && (
        <div className="stock panel empty" style={{ marginBottom: "var(--space-lg)" }}>
          <h2>Start with the assessment</h2>
          <p>Six short steps about you, your status, education, language tests, work and where you&apos;d live. It takes about 15 minutes, and you can stop any time.</p>
          <Link href="/assessment" className="btn btn--ink">Start the assessment</Link>
        </div>
      )}

      {flags.length > 0 && (
        <div className="notice" role="note" style={{ marginBottom: "var(--space-lg)" }}>
          <strong>Get professional advice.</strong> {flags.join(" ")} An{" "}
          <a href={SRC.cicc} target="_blank" rel="noopener noreferrer">authorized consultant (RCIC)</a> or lawyer can look at the details we can&apos;t.
        </div>
      )}

      <div className="dash">
        <div className="dash__col">
          <section className="stock panel" aria-labelledby="status-h">
            <h2 id="status-h">Your status</h2>
            <dl className="status-row">
              <div className="stat">
                <dt>Status today</dt>
                <dd>{profile.status ? STATUS_LABELS[profile.status].split(" (")[0] : "Not answered"}</dd>
              </div>
              {profile.permitExpiryDate && (
                <div className="stat">
                  <dt>Permit expires</dt>
                  <dd>{fmt(profile.permitExpiryDate)}</dd>
                  <dd className="small muted" style={{ fontWeight: 400, fontSize: "var(--text-sm)", letterSpacing: 0 }}>{expiry !== null && inDays(expiry)}</dd>
                </div>
              )}
              {profile.arrivalDate && (
                <div className="stat">
                  <dt>In Canada since</dt>
                  <dd>{fmt(profile.arrivalDate)}</dd>
                </div>
              )}
            </dl>
            {!profile.status && <p className="small muted" style={{ marginTop: "var(--space-sm)" }}><Link href="/assessment?step=status">Add your status</Link> to get expiry reminders.</p>}
          </section>

          <section className="stock sheet" aria-labelledby="crs-h">
            <div className="sheet__head">
              <div>
                <h2 id="crs-h" className="sheet__title">Your <Term k="crs">CRS</Term> score</h2>
                <p className="sheet__meta">Rules in effect from {rules.effectiveFrom}</p>
              </div>
              <p className="total-fig">{result ? result.total : "Not yet"}</p>
            </div>
            {result ? (
              <>
                <table className="ledger">
                  <caption className="visually-hidden">Score by section</caption>
                  <tbody>
                    {result.sections.map((s) => (
                      <tr key={s.key}>
                        <th scope="row">{s.label}</th>
                        <td className="num">{s.points}</td>
                        <td className="num muted">of {s.max}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {lastAssessment && (
                  <p className="small muted">
                    Last recorded: {lastAssessment.total} on {lastAssessment.createdAt.toLocaleDateString("en-CA")} (rules {lastAssessment.ruleSetVersion}).{" "}
                    {lastAssessment.total !== result.total && `That's ${result.total > lastAssessment.total ? "up" : "down"} ${Math.abs(result.total - lastAssessment.total)} since.`}
                  </p>
                )}
                <div className="actions">
                  <Link href="/crs" className="btn btn--card btn--sm">See every point and try what-ifs</Link>
                </div>
                <p className="small muted">A score doesn&apos;t mean you qualify. You must also meet one Express Entry program&apos;s requirements.</p>
              </>
            ) : (
              <p className="small">We need your date of birth and education to calculate a score. <Link href="/assessment">Continue the assessment</Link>.</p>
            )}
          </section>

          <section className="stock panel" aria-labelledby="path-h">
            <h2 id="path-h">Potential PR pathways</h2>
            {report ? (
              <>
                <ul className="list">
                  {topPaths.map((r) => (
                    <li key={r.id}>
                      <div className="row">
                        <strong style={{ fontWeight: 500 }}>{r.name}</strong>
                        <span className="tag">{r.bucket === "potential" ? "Requirements met" : STATUS_LABEL[r.status]}</span>
                      </div>
                      <span className="small muted">{r.reasons[0] ?? r.gaps[0] ?? r.statusNote}</span>
                    </li>
                  ))}
                </ul>
                <p className="small" style={{ marginTop: "var(--space-sm)" }}>
                  {report.potential.length} potential, {report.needsInfo.length} worth checking. <Link href="/pathways">See every pathway and your action plan</Link>
                </p>
              </>
            ) : (
              <p className="small">Complete the assessment to see matched pathways. <Link href="/pathways">Browse all programs</Link></p>
            )}
          </section>
        </div>

        <div className="dash__col">
          <section className="stock panel" aria-labelledby="dl-h">
            <h2 id="dl-h">Deadlines</h2>
            {deadlines.length ? (
              <ul className="list">
                {deadlines.map((d, i) => {
                  const n = daysUntil(d.dueDate, now);
                  return (
                    <li key={d.id ?? `${d.kind}-${i}`}>
                      <div className="row">
                        <strong style={{ fontWeight: 500 }}>{d.title}</strong>
                        {n < 0 ? <span className="tag tag--urgent">Passed</span> : d.urgent ? <span className="tag tag--urgent">Soon</span> : null}
                      </div>
                      <span className="small"><span className="fig">{d.dueDate}</span>, {inDays(n)}</span>
                      {d.detail && <span className="small muted">{d.detail} {d.sourceUrl && <a href={d.sourceUrl} target="_blank" rel="noopener noreferrer">IRCC page</a>}</span>}
                      {d.id && (
                        <form action={dismissDeadlineAction}>
                          <input type="hidden" name="id" value={d.id} />
                          <button type="submit" className="linklike small">Remove</button>
                        </form>
                      )}
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="small muted" style={{ marginBottom: "var(--space-md)" }}>No deadlines yet. Add your permit expiry, test dates and ECA date in the assessment and we&apos;ll track them.</p>
            )}
            <AddDeadline />
            <p className="small muted" style={{ marginTop: "var(--space-md)" }}>Reminders show here. Email reminders are planned.</p>
          </section>

          <section className="stock panel" aria-labelledby="miss-h">
            <h2 id="miss-h">Missing information</h2>
            {derived.missing.length || remainingSteps.length ? (
              <ul className="list small">
                {derived.missing.map((m, i) => (
                  <li key={i}><Link href={`/assessment?step=${m.step}`}>{m.message}</Link></li>
                ))}
                {remainingSteps.filter((s) => !derived.missing.some((m) => m.step === s.key)).map((s) => (
                  <li key={s.key}><Link href={`/assessment?step=${s.key}`}>{s.label}: not saved yet.</Link></li>
                ))}
              </ul>
            ) : (
              <p className="small muted">Nothing missing for the score. Keep your answers up to date as things change.</p>
            )}
            {derived.notes.length > 0 && (
              <ul className="list small muted" style={{ marginTop: "var(--space-sm)" }}>
                {derived.notes.map((n) => <li key={n}>{n}</li>)}
              </ul>
            )}
          </section>

          <section className="stock panel" aria-labelledby="next-h">
            <h2 id="next-h">Recommended next steps</h2>
            {nextSteps.length ? (
              <ol className="list small" style={{ paddingLeft: 0 }}>
                {nextSteps.map((n) => (
                  <li key={n.text}>
                    {n.external ? <a href={n.href} target="_blank" rel="noopener noreferrer">{n.text}</a> : <Link href={n.href}>{n.text}</Link>}
                  </li>
                ))}
              </ol>
            ) : (
              <p className="small muted">You&apos;re up to date.</p>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
