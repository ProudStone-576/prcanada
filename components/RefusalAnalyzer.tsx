"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { analyzeRefusalAction, type RefusalResponse } from "@/app/actions/refusal";
import { APP_LABEL, type RefusalResult } from "@/lib/engine/refusal";
import type { AiExplanation } from "@/lib/ai/explain";

const KIND = { legal_challenge: "Legal challenge", administrative: "Administrative step", advice: "Advice", information: "Information" } as const;

export function RefusalAnalyzer({ signedIn, aiAvailable, letters }: { signedIn: boolean; aiAvailable: boolean; letters: Array<{ id: string; label: string }> }) {
  const [text, setText] = useState("");
  const [docId, setDocId] = useState("");
  const [notifiedOn, setNotifiedOn] = useState("");
  const [where, setWhere] = useState<"in_canada" | "outside_canada" | "unknown">("unknown");
  const [ai, setAi] = useState(false);
  const [save, setSave] = useState(true);
  const [res, setRes] = useState<RefusalResponse | null>(null);
  const [pending, start] = useTransition();

  return (
    <div className="calc">
      <form
        className="form"
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          start(async () => setRes(await analyzeRefusalAction({ text: docId ? undefined : text, documentId: docId || undefined, notifiedOn, where, ai, save })));
        }}
      >
        {letters.length > 0 && (
          <div className="field">
            <label htmlFor="rf-doc">Use an uploaded refusal letter</label>
            <select id="rf-doc" className="input" value={docId} onChange={(e) => setDocId(e.target.value)}>
              <option value="">No, I&apos;ll paste the text</option>
              {letters.map((l) => <option key={l.id} value={l.id}>{l.label}</option>)}
            </select>
          </div>
        )}
        {!docId && (
          <div className="field">
            <label htmlFor="rf-text">The letter&apos;s text</label>
            <textarea id="rf-text" className="input" style={{ minHeight: 240 }} value={text} maxLength={50000} onChange={(e) => setText(e.target.value)} />
            <p className="hint">Paste the whole letter, including the reasons. Remove your UCI and application numbers if you like; we don&apos;t need them.{signedIn ? "" : " Nothing you paste here is stored."}</p>
          </div>
        )}
        <div className="grid-2">
          <div className="field">
            <label htmlFor="rf-date">Date you received the decision</label>
            <input id="rf-date" type="date" className="input" value={notifiedOn} onChange={(e) => setNotifiedOn(e.target.value)} />
            <p className="hint">Used to calculate court and restoration deadlines.</p>
          </div>
          <div className="field">
            <label htmlFor="rf-where">Where was the application decided?</label>
            <select id="rf-where" className="input" value={where} onChange={(e) => setWhere(e.target.value as typeof where)}>
              <option value="unknown">Not sure</option>
              <option value="in_canada">In Canada (applied from inside Canada)</option>
              <option value="outside_canada">Outside Canada (visa office abroad)</option>
            </select>
          </div>
        </div>
        {signedIn && (
          <label className="check">
            <input type="checkbox" checked={save} onChange={(e) => setSave(e.target.checked)} />
            <span>Save this analysis to my account, encrypted.</span>
          </label>
        )}
        {signedIn && aiAvailable && (
          <label className="check">
            <input type="checkbox" checked={ai} onChange={(e) => setAi(e.target.checked)} />
            <span>Also send the letter&apos;s text to Anthropic&apos;s Claude AI for a plain-language explanation. This shares the letter with a third-party service; see the privacy policy.</span>
          </label>
        )}
        <div className="actions">
          <button type="submit" className="btn btn--ink" disabled={pending} aria-busy={pending}>{pending ? "Reading the letter" : "Analyze the letter"}</button>
        </div>
        {!signedIn && <p className="small muted"><Link href="/signup">Create an account</Link> to upload PDF letters and keep your analyses.</p>}
      </form>

      <div aria-live="polite">
        {res?.error && <p className="notice notice--error" role="alert">{res.error}</p>}
        {res?.result && <RefusalReport result={res.result} ai={res.ai} />}
        {!res && <p className="small muted">Your analysis appears here: what was refused, the officer&apos;s concerns, deadlines, and your options.</p>}
      </div>
    </div>
  );
}

export function RefusalReport({ result, ai }: { result: RefusalResult; ai: AiExplanation | null }) {
  return (
    <div className="form" style={{ gap: "var(--space-lg)" }}>
      {result.needsProfessional && (
        <p className="notice notice--error">
          <strong>Have a licensed professional review this letter.</strong>{" "}
          {result.flags.length ? `It raises: ${result.flags.map((f) => f.title.toLowerCase()).join(", ")}.` : "We couldn't analyze it with confidence."} We can explain it, but we can&apos;t give legal advice.{" "}
          <a href="https://college-ic.ca/protecting-the-public/find-an-immigration-consultant" target="_blank" rel="noopener noreferrer">Find a licensed consultant</a>
        </p>
      )}

      <section className="stock panel">
        <h2>What was refused</h2>
        <p><strong style={{ fontWeight: 500 }}>{APP_LABEL[result.appType]}</strong></p>
        {result.appTypeEvidence && <p className="why">From the letter: &ldquo;{result.appTypeEvidence}&rdquo;</p>}
        {result.notes.map((n) => <p key={n} className="small muted" style={{ marginTop: "var(--space-xs)" }}>{n}</p>)}
      </section>

      {result.deadlines.length > 0 && (
        <section className="stock panel">
          <h2>Deadlines</h2>
          <ul className="list small">
            {result.deadlines.map((d) => (
              <li key={d.title}>
                <div className="row">
                  <strong style={{ fontWeight: 500 }}>{d.title}</strong>
                  {d.date && <span className="tag tag--urgent fig">{d.date}</span>}
                </div>
                <span className="muted">{d.basis}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {result.flags.length > 0 && (
        <section className="stock panel">
          <h2>Serious issues in this letter</h2>
          <ul className="list small">
            {result.flags.map((f) => <li key={f.key}><strong style={{ fontWeight: 500 }}>{f.title}.</strong> <span className="muted">{f.why}</span></li>)}
          </ul>
        </section>
      )}

      <section className="stock panel">
        <h2>The officer&apos;s concerns</h2>
        {result.grounds.length === 0 ? (
          <p className="small muted">We didn&apos;t find the reasons in this text.</p>
        ) : (
          <div className="recs">
            {result.grounds.map((g) => (
              <details key={g.key} className="rec">
                <summary className="rec__sum"><span className="rec__name" style={{ fontSize: "var(--text-md)" }}>{g.title}</span></summary>
                <div className="rec__body small">
                  <p className="why">From the letter: &ldquo;{g.quote}&rdquo;</p>
                  <p>{g.plain}</p>
                  <div>
                    <h3 className="rec__h">Law the officer relies on</h3>
                    <ul>{g.law.map((l) => <li key={l.cite}><a href={l.url} target="_blank" rel="noopener noreferrer">{l.cite}</a>: {l.summary}</li>)}</ul>
                  </div>
                  <div>
                    <h3 className="rec__h">Evidence that often speaks to this</h3>
                    <ul>{g.evidence.map((x) => <li key={x}>{x}</li>)}</ul>
                  </div>
                </div>
              </details>
            ))}
          </div>
        )}
      </section>

      {ai && (
        <section className="stock panel">
          <h2>Plain-language explanation</h2>
          {ai.ok ? (
            <>
              {ai.text.split(/\n{2,}/).map((p, i) => <p key={i} className="small" style={{ marginBottom: "var(--space-sm)" }}>{p}</p>)}
              <p className="small muted">Written by AI ({ai.model}) from the letter&apos;s text. It can be wrong; the deadlines and options above don&apos;t come from it.</p>
            </>
          ) : (
            <p className="small muted">{ai.reason}</p>
          )}
        </section>
      )}

      <section className="stock panel">
        <h2>Your options</h2>
        <p className="small muted" style={{ marginBottom: "var(--space-sm)" }}>Listed for you to weigh, not ranked as advice. A new application and a legal challenge are different things.</p>
        <ul className="list small">
          {result.nextSteps.map((s) => (
            <li key={s.key}>
              <div className="row">
                <strong style={{ fontWeight: 500 }}>{s.title}</strong>
                <span className="tag">{KIND[s.kind]}</span>
              </div>
              <span>{s.when}</span>
              <span className="muted">{s.caution}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
