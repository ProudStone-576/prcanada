import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { aiEnabled } from "@/lib/ai/explain";
import { AssistantChat } from "@/components/AssistantChat";

export const metadata = { title: "Ask about your results" };

export default async function AssistantPage() {
  await requireUser();
  const enabled = aiEnabled();
  return (
    <div className="container app-main">
      <header className="page-head">
        <h1>Ask about your results</h1>
        <p>An AI assistant that explains your own scores, pathways and deadlines in plain words. It works from what this site calculated for you and the official pages behind it. It can be wrong, it isn&apos;t legal advice, and it never applies, signs or writes anything for you.</p>
      </header>
      {enabled ? (
        <AssistantChat />
      ) : (
        <div className="stock panel empty" style={{ maxWidth: 720 }}>
          <h2>The assistant isn&apos;t turned on here</h2>
          <p>Everything it would explain is already on your pages: your <Link href="/dashboard">dashboard</Link>, <Link href="/crs">CRS breakdown</Link> and <Link href="/pathways">pathways and action plan</Link>.</p>
        </div>
      )}
    </div>
  );
}
