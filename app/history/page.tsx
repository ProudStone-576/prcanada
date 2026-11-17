import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";

export const metadata = { title: "History" };

export default async function HistoryPage() {
  const user = await requireUser();
  const rows = await db.assessment.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" }, take: 100 });
  return (
    <div className="container app-main">
      <header className="page-head">
        <h1>Your history</h1>
        <p>Every score you record is frozen with the answers and the rule version used, so you can see exactly how it was worked out even after IRCC changes the rules.</p>
      </header>
      {rows.length ? (
        <table className="ledger" style={{ maxWidth: "760px" }}>
          <thead>
            <tr>
              <th scope="col">Recorded</th>
              <th scope="col">Rules</th>
              <th scope="col" className="num">CRS</th>
              <th scope="col"><span className="visually-hidden">Open</span></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td className="fig">{r.createdAt.toISOString().slice(0, 16).replace("T", " ")} UTC</td>
                <td className="fig">{r.ruleSetVersion}</td>
                <td className="num">{r.total}</td>
                <td style={{ textAlign: "right" }}><Link href={`/history/${r.id}`}>Open</Link></td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <div className="empty">
          <p>No recorded scores yet. Record one from the calculator when you want a dated snapshot.</p>
          <Link href="/crs" className="btn btn--ink">Open the calculator</Link>
        </div>
      )}
    </div>
  );
}
