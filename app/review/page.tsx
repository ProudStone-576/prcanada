import { requireReviewer } from "@/lib/roles";
import { db } from "@/lib/db";
import { ReviewItemCard } from "@/components/ReviewItemCard";

export const metadata = { title: "Review queue" };

export default async function ReviewPage() {
  await requireReviewer();
  const [pending, watches] = await Promise.all([
    db.reviewItem.findMany({ where: { status: "pending" }, include: { watch: true }, orderBy: { detectedAt: "asc" }, take: 50 }),
    db.sourceWatch.findMany({ orderBy: [{ lastStatus: "asc" }, { label: "asc" }], select: { id: true, url: true, label: true, jurisdiction: true, lastFetchedAt: true, lastStatus: true, lastChangedAt: true } }),
  ]);
  const failing = watches.filter((w) => w.lastStatus && !["No change", "Changed", "Baseline saved"].includes(w.lastStatus));

  return (
    <div className="container app-main">
      <header className="page-head">
        <h1>Review queue</h1>
        <p>Changes the monitor found on official pages. Nothing reaches users until you publish it. Dismiss changes that don&apos;t affect anyone.</p>
      </header>
      <div className="dash">
        <div className="dash__col">
          <section aria-labelledby="q-h">
            <h2 id="q-h" className="sect-h">Waiting for review <span className="muted fig">{pending.length}</span></h2>
            <div className="recs">
              {pending.length === 0 && <p className="empty">Nothing to review. The monitor checks every watched page when the scheduled job runs.</p>}
              {pending.map((r) => (
                <ReviewItemCard key={r.id} item={{ id: r.id, label: r.watch.label, url: r.watch.url, jurisdiction: r.watch.jurisdiction, detectedAt: r.detectedAt.toISOString().slice(0, 16).replace("T", " "), added: r.added, removed: r.removed }} />
              ))}
            </div>
          </section>
          <section aria-labelledby="m-h">
            <h2 id="m-h" className="sect-h">Publish without a detected change</h2>
            <ReviewItemCard item={{ id: null, label: "Manual update", url: "https://www.canada.ca/en/immigration-refugees-citizenship/news.html", jurisdiction: "Federal", detectedAt: "", added: [], removed: [] }} />
          </section>
        </div>
        <aside className="dash__col">
          <section className="stock panel" aria-labelledby="w-h">
            <h2 id="w-h">Watched pages</h2>
            <p className="small muted" style={{ marginBottom: "var(--space-sm)" }}>{watches.length} pages. {failing.length} couldn&apos;t be read last time.</p>
            <ul className="list small">
              {(failing.length ? failing : watches.slice(0, 12)).map((w) => (
                <li key={w.id}>
                  <div className="row"><a href={w.url} target="_blank" rel="noopener noreferrer">{w.label}</a><span className="tag">{w.lastStatus ?? "Not checked"}</span></div>
                  <span className="muted">{w.lastFetchedAt ? `Checked ${w.lastFetchedAt.toISOString().slice(0, 16).replace("T", " ")} UTC` : "Not checked yet"}</span>
                </li>
              ))}
            </ul>
          </section>
        </aside>
      </div>
    </div>
  );
}
