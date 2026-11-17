import { SRC } from "@/lib/sources";
import { Term } from "@/components/Term";

export const metadata = { title: "PR pathways", description: "The permanent residence programs PRPath Canada covers, with links to each official page." };

const groups: Array<{ title: string; intro: string; items: Array<{ name: string; note: string; url: string }> }> = [
  {
    title: "Express Entry",
    intro: "Three federal programs share one pool ranked by CRS. IRCC also runs category-based rounds for specific occupations or French ability.",
    items: [
      { name: "Express Entry: who can apply", note: "Canadian Experience Class, Federal Skilled Worker Program, Federal Skilled Trades Program.", url: SRC.eeEligibility },
      { name: "Rounds of invitations", note: "Past draws and categories, published by IRCC.", url: SRC.rounds },
    ],
  },
  {
    title: "Provincial and territorial nominees",
    intro: "Each province and territory runs its own streams, and they open, pause and close often. Nunavut has no nominee program. Quebec selects its own economic immigrants.",
    items: [
      { name: "Provincial Nominee Program", note: "IRCC's overview, with links to every province and territory.", url: SRC.pnp },
      { name: "Immigration to Quebec", note: "Quebec issues its own selection certificate before you apply to IRCC.", url: SRC.quebec },
    ],
  },
  {
    title: "Community and regional",
    intro: "Pilots and programs that tie permanent residence to living and working in a particular region or community.",
    items: [
      { name: "Rural and Francophone community pilots", note: "Participating communities and their recommendation process.", url: SRC.ruralFranco },
      { name: "Atlantic Immigration Program", note: "Employer-driven, for Nova Scotia, New Brunswick, Prince Edward Island, and Newfoundland and Labrador.", url: SRC.atlantic },
    ],
  },
  {
    title: "Family and other",
    intro: "Sponsorship and protection have their own rules. Humanitarian and compassionate applications in particular need professional advice.",
    items: [
      { name: "Family sponsorship", note: "Spouses, partners, children, parents and grandparents.", url: SRC.family },
      { name: "Refugee protection in Canada", note: "Claiming asylum from inside Canada.", url: SRC.refugeeInCanada },
    ],
  },
];

export default function PathwaysPage() {
  return (
    <div className="container app-main">
      <header className="page-head">
        <h1>Permanent residence pathways</h1>
        <p>
          Personal matching is being built next. Until we can check each program&apos;s current rules and status against its official source, we link you there directly rather than guess.
        </p>
      </header>
      <div className="notice" style={{ marginBottom: "var(--space-2xl)" }}>
        <strong>What comes next:</strong> eligibility checks for each <Term k="express_entry">Express Entry</Term> program, <Term k="noc">NOC</Term> matching from your job duties, a provincial stream database with open, paused and closed statuses, and a ranked plan with milestones.
      </div>
      <div className="prose" style={{ maxWidth: "860px" }}>
        {groups.map((g) => (
          <section key={g.title}>
            <h2>{g.title}</h2>
            <p>{g.intro}</p>
            <ul className="list">
              {g.items.map((i) => (
                <li key={i.url}>
                  <a href={i.url} target="_blank" rel="noopener noreferrer">{i.name}</a>
                  <span className="small muted">{i.note}</span>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}
