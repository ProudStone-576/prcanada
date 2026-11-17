import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { ruleSetByVersion } from "@/lib/engine/crs/rules";
import type { CrsResult } from "@/lib/engine/crs/types";
import { Breakdown } from "@/components/Breakdown";

export const metadata = { title: "Recorded score" };

export default async function AssessmentDetail({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  // Scoped by user: another user's id returns not found, never their data.
  const row = await db.assessment.findFirst({ where: { id, userId: user.id } });
  if (!row) notFound();
  const result = row.result as unknown as CrsResult;
  const rules = ruleSetByVersion(row.ruleSetVersion);
  return (
    <div className="container app-main">
      <p className="small"><Link href="/history">All recorded scores</Link></p>
      <header className="page-head" style={{ marginTop: "var(--space-md)" }}>
        <h1>CRS {row.total}</h1>
        <p>
          Recorded {row.createdAt.toLocaleString("en-CA", { timeZone: "UTC" })} UTC with the rules in effect from {rules.effectiveFrom}
          {rules.effectiveTo ? ` to ${rules.effectiveTo}` : ""}. {rules.summary}
        </p>
      </header>
      <section className="stock sheet" style={{ maxWidth: "760px" }}>
        {result.warnings?.map((w) => <p key={w} className="notice">{w}</p>)}
        <Breakdown result={result} caption="Recorded CRS breakdown" />
        <p className="small muted">
          Source: <a href={rules.sourceUrl} target="_blank" rel="noopener noreferrer">IRCC CRS criteria</a>, checked {rules.verifiedAt}.
        </p>
      </section>
    </div>
  );
}
