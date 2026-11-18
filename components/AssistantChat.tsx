"use client";

import { useRef, useState, useTransition } from "react";
import { askAssistantAction } from "@/app/actions/assistant";

type Turn = { role: "user" | "assistant"; content: string };

const STARTERS = ["Why is my CRS score what it is?", "What should I do before my permit expires?", "Which pathway should I look at first, and why?", "What does maintained status mean for me?"];

export function AssistantChat() {
  const [turns, setTurns] = useState<Turn[]>([]);
  const [q, setQ] = useState("");
  const [consent, setConsent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const input = useRef<HTMLTextAreaElement>(null);

  function ask(question: string) {
    const text = question.trim();
    if (!text) return;
    if (!consent) return setError("Tick the box above to agree to sending your question to the AI service.");
    setError(null);
    const next: Turn[] = [...turns, { role: "user", content: text }];
    setTurns(next);
    setQ("");
    start(async () => {
      const r = await askAssistantAction(next, consent);
      if (r.ok) setTurns([...next, { role: "assistant", content: r.text }]);
      else {
        setError(r.reason);
        setTurns(turns);
        setQ(text);
      }
      input.current?.focus();
    });
  }

  return (
    <div className="chat">
      <label className="check">
        <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
        <span>I agree to send my questions and a summary of my results (scores, pathways and deadlines, not my documents) to Anthropic&apos;s Claude AI to answer them. The conversation isn&apos;t saved to my account.</span>
      </label>

      <div className="chat__log" aria-live="polite">
        {turns.length === 0 && (
          <div className="whatifs">
            {STARTERS.map((s) => (
              <button key={s} type="button" className="btn btn--card btn--sm" disabled={pending} onClick={() => ask(s)}>{s}</button>
            ))}
          </div>
        )}
        {turns.map((t, i) => (
          <div key={i} className={t.role === "user" ? "chat__q" : "stock chat__a"}>
            <p className="label">{t.role === "user" ? "You" : "Assistant"}</p>
            {t.content.split(/\n{2,}/).map((para, j) => <p key={j} className="small">{para}</p>)}
          </div>
        ))}
        {pending && <p className="small muted">Thinking about your question</p>}
      </div>

      {error && <p className="notice notice--error" role="alert">{error}</p>}

      <form className="form" onSubmit={(e) => { e.preventDefault(); ask(q); }}>
        <div className="field">
          <label htmlFor="chat-q">Your question</label>
          <textarea id="chat-q" ref={input} className="input" value={q} maxLength={4000} onChange={(e) => setQ(e.target.value)} />
        </div>
        <div className="actions">
          <button type="submit" className="btn btn--ink" disabled={pending} aria-busy={pending}>Ask</button>
          {turns.length > 0 && <button type="button" className="linklike small" onClick={() => { setTurns([]); setError(null); }}>Start over</button>}
        </div>
      </form>
    </div>
  );
}
