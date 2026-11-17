import Link from "next/link";
import { calculateCrs } from "@/lib/engine/crs/calculate";
import { CRS_2026_11_03, CRS_RULE_SETS } from "@/lib/engine/crs/rules";
import type { CrsInput } from "@/lib/engine/crs/types";
import { SRC, VERIFIED_AT } from "@/lib/sources";

const SAMPLE: CrsInput = {
  age: 29,
  accompanyingSpouse: false,
  education: "bachelors_or_three_year",
  english: { listening: 9, reading: 9, writing: 9, speaking: 9 },
  french: null,
  firstLanguage: "auto",
  canadianWorkYears: 1,
  foreignWorkYears: 0,
  highWageExperience: "none",
  jobOffer: "none",
  certificateOfQualification: false,
  canadianEducation: "three_year_or_more",
  siblingInCanada: false,
  provincialNomination: false,
  spouse: null,
};

const verified = new Date(VERIFIED_AT + "T00:00:00Z").toLocaleDateString("en-CA", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });

export default async function Home({ searchParams }: { searchParams: Promise<{ deleted?: string }> }) {
  const { deleted } = await searchParams;
  const sample = calculateCrs(SAMPLE, CRS_2026_11_03);
  const lines = sample.sections.flatMap((s) => s.lines).filter((l) => l.points > 0);

  return (
    <>
      {deleted && (
        <div className="container" style={{ paddingTop: "var(--space-lg)" }}>
          <p className="notice notice--ok" role="status">Your account and everything in it has been deleted.</p>
        </div>
      )}

      <section className="hero desk" aria-labelledby="hero-h">
        <div className="container hero__grid">
          <div>
            <h1 id="hero-h">Know where you stand in Canada.</h1>
            <p className="lead">Your CRS score, worked line by line from IRCC&apos;s own tables.</p>
            <div className="actions">
              <Link href="/signup" className="btn btn--ink btn--lg">Start your assessment</Link>
              <Link href="/crs" className="btn btn--card btn--lg">Calculate CRS</Link>
            </div>
            <p className="hero__aside">Free. Information, not legal advice.</p>
          </div>

          <div className="hero__stage" data-slot="score-sheet" role="img" aria-label={`Sample CRS score sheet totalling ${sample.total} points`}>
            <div className="stock sheet">
              <div className="sheet__head">
                <div>
                  <p className="sheet__title">CRS score sheet</p>
                  <p className="sheet__meta">Sample profile: PGWP holder, age 29</p>
                  <p className="sheet__meta">Rules in effect from {CRS_2026_11_03.effectiveFrom}</p>
                </div>
                <p className="total-fig">{sample.total}</p>
              </div>
              <table className="ledger">
                <caption className="visually-hidden">Sample points breakdown</caption>
                <tbody>
                  {lines.map((l) => (
                    <tr key={l.key}>
                      <th scope="row">{l.label.replace(/ \(.+\)$/, "")}</th>
                      <td className="num">{l.points}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <th scope="row">Total</th>
                    <td className="num">{sample.total}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
            <div className="stock permit-card" aria-hidden="true">
              <span className="muted">Post-graduation work permit</span>
              <b>Expires in 214 days</b>
              <span className="fig">Reminder set</span>
            </div>
            <p className="stamp-pos" aria-hidden="true"><span className="pressed">Checked {verified}</span></p>
          </div>
        </div>
      </section>

      <section className="section section--after-hero" aria-labelledby="doors-h">
        <div className="container">
          <h2 id="doors-h">Start where you are</h2>
          
          <div className="doors">
            <Link href="/signup" className="stock door door--lead">
              <h3>Start your immigration assessment</h3>
              <p>Six short steps. You get your score, deadlines and what&apos;s missing.</p>
              
            </Link>
            <Link href="/crs" className="stock door door--wide">
              <h3>Calculate your CRS</h3>
              <p>Every point explained, with what-ifs.</p>
            </Link>
            <Link href="/pathways" className="stock door door--wide">
              <h3>Explore PR pathways</h3>
              <p>Official program pages. Matching comes next.</p>
            </Link>
            <Link href="/work-permits" className="stock door door--third">
              <h3>Check work permit options</h3>
              <p>Permits and status, explained.</p>
            </Link>
            <Link href="/refusal" className="stock door door--third">
              <h3>Analyze a refusal letter</h3>
              <p>Deadlines that can&apos;t wait.</p>
            </Link>
            <Link href="/updates" className="stock door door--third">
              <h3>Immigration updates</h3>
              <p>Official sources only.</p>
            </Link>
          </div>
        </div>
      </section>

      <section className="section board" aria-labelledby="rules-h">
        <div className="container board__grid">
          <div>
            <h2 id="rules-h">The CRS changed on November 3, 2026.</h2>
            <p style={{ marginTop: "var(--space-lg)" }}>
              <a href={SRC.crsChanges} target="_blank" rel="noopener noreferrer">Read IRCC&apos;s announcement</a>
            </p>
          </div>
          <table className="ledger">
            <caption className="visually-hidden">What changed on November 3, 2026</caption>
            <thead>
              <tr>
                <th scope="col">What changed</th>
                <th scope="col" className="num">Points</th>
              </tr>
            </thead>
            <tbody>
              <tr><td>High-wage job offer, no LMIA needed</td><td className="num">50 to 100</td></tr>
              <tr><td>12 months of high-wage Canadian work</td><td className="num">20 to 70</td></tr>
              <tr><td>Work or job offer: the higher counts</td><td className="num">up to 150</td></tr>
              <tr><td>Older scores keep their rules</td><td className="num">{CRS_RULE_SETS.length} versions</td></tr>
            </tbody>
          </table>
        </div>
      </section>

      <section className="section" aria-labelledby="promise-h">
        <div className="container honesty">
          <h2 id="promise-h">What we will and won&apos;t do</h2>
          <ul className="promise">
            <li>We calculate, never guess.</li>
            <li>We show the source and date.</li>
            <li>We send you to a professional when it matters.</li>
          </ul>
        </div>
      </section>
    </>
  );
}
