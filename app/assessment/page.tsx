import { requireUser } from "@/lib/auth";
import { loadProfile } from "@/lib/profile/store";
import { STEPS, type StepKey } from "@/lib/profile/schema";
import { AssessmentForm } from "@/components/AssessmentForm";

export const metadata = { title: "Your assessment" };

export default async function AssessmentPage({ searchParams }: { searchParams: Promise<{ step?: string }> }) {
  const user = await requireUser();
  const { step } = await searchParams;
  const current = (STEPS.find((s) => s.key === step)?.key ?? "about") as StepKey;
  const { profile, completedSteps } = await loadProfile(user.id);
  const today = new Date().toISOString().slice(0, 10);
  return (
    <div className="container app-main">
      <header className="page-head">
        <h1>Your immigration assessment</h1>
        <p>Six short steps. Answer what you know; &quot;not sure&quot; is a fine answer, and we&apos;ll list what&apos;s still needed. Everything saves to your account, encrypted.</p>
      </header>
      <AssessmentForm key={current} initial={profile} step={current} completed={completedSteps} today={today} />
    </div>
  );
}
