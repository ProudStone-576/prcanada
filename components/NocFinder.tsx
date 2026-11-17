"use client";
import { useState, useTransition } from "react";
import { suggestNocAction } from "@/app/actions/noc";
import type { NocMatch } from "@/lib/engine/noc/match";
import { NocResults } from "./NocResults";

export function NocFinder() {
  const [duties, setDuties] = useState("");
  const [title, setTitle] = useState("");
  const [result, setResult] = useState<NocMatch | null>(null);
  const [pending, start] = useTransition();
  const words = duties.trim().split(/\s+/).filter(Boolean).length;
  return (
    <div className="calc">
      <form className="form" onSubmit={(e) => { e.preventDefault(); start(async () => setResult(await suggestNocAction(duties, title))); }}>
        <div className="field">
          <label htmlFor="noc-duties">What do you actually do at work?</label>
          <textarea id="noc-duties" className="input" style={{ minHeight: 220 }} value={duties} maxLength={6000} onChange={(e) => setDuties(e.target.value)} />
          <p className="hint">List your main tasks in your own words, the way you would in a reference letter. At least 25 words; {words} so far.</p>
        </div>
        <div className="field">
          <label htmlFor="noc-title">Job title (optional)</label>
          <input id="noc-title" className="input" value={title} maxLength={200} onChange={(e) => setTitle(e.target.value)} />
          <p className="hint">We don&apos;t use the title to choose a code. We only warn you if it points somewhere your duties don&apos;t.</p>
        </div>
        <div className="actions">
          <button type="submit" className="btn btn--ink" disabled={pending} aria-busy={pending}>{pending ? "Comparing" : "Find matching occupations"}</button>
        </div>
      </form>
      <div aria-live="polite">{result ? <NocResults result={result} /> : <p className="small muted">Results appear here, with each official duty marked against your description.</p>}</div>
    </div>
  );
}
