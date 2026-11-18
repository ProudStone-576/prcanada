"use client";

import { useState, useTransition } from "react";
import { dismissReviewAction, publishUpdateAction } from "@/app/actions/review";
import { KIND_LABEL, UPDATE_KINDS } from "@/lib/updates";

export interface ReviewView {
  id: string | null;
  label: string;
  url: string;
  jurisdiction: string;
  detectedAt: string;
  added: string[];
  removed: string[];
}


export function ReviewItemCard({ item }: { item: ReviewView }) {
  const [mode, setMode] = useState<"view" | "publish">(item.id ? "view" : "publish");
  const [f, setF] = useState({ kind: "other" as (typeof UPDATE_KINDS)[number], title: "", summary: "", jurisdiction: item.jurisdiction, sourceUrl: item.url, announcedOn: "", effectiveOn: "", status: "announced" as "announced" | "in_effect" | "ended" });
  const [note, setNote] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((x) => ({ ...x, [k]: v }));

  return (
    <article className="stock panel rec__body" style={{ marginTop: 0 }}>
      <div className="row" style={{ display: "flex", justifyContent: "space-between", gap: "var(--space-md)", flexWrap: "wrap" }}>
        <h3 style={{ fontSize: "var(--text-lg)" }}>{item.label}</h3>
        <span className="small muted">{item.jurisdiction}{item.id ? `, detected ${item.detectedAt}` : ""}</span>
      </div>
      <p className="small"><a href={item.url} target="_blank" rel="noopener noreferrer">{item.url}</a></p>
      {item.id && (
        <div className="diff">
          {item.removed.slice(0, 40).map((l, i) => <p key={`r${i}`} className="diff__del"><span className="visually-hidden">Removed: </span>{l}</p>)}
          {item.added.slice(0, 40).map((l, i) => <p key={`a${i}`} className="diff__add"><span className="visually-hidden">Added: </span>{l}</p>)}
          {item.added.length + item.removed.length > 80 && <p className="small muted">More changes than shown; open the page to read it in full.</p>}
        </div>
      )}
      {mode === "view" ? (
        <div className="form" style={{ gap: "var(--space-sm)" }}>
          <div className="field">
            <label htmlFor={`n-${item.id}`}>Note (optional)</label>
            <input id={`n-${item.id}`} className="input" value={note} maxLength={500} onChange={(e) => setNote(e.target.value)} placeholder="For example: wording change only" />
          </div>
          <div className="actions">
            <button type="button" className="btn btn--card btn--sm" disabled={pending} onClick={() => start(() => dismissReviewAction(item.id!, note))}>No user-facing change</button>
            <button type="button" className="btn btn--card btn--sm" onClick={() => setMode("publish")}>Publish an update</button>
          </div>
        </div>
      ) : (
        <form
          className="form"
          onSubmit={(e) => {
            e.preventDefault();
            start(async () => {
              const r = await publishUpdateAction(item.id, f);
              setMsg(r.error ?? "Published.");
            });
          }}
        >
          <div className="grid-2">
            <div className="field">
              <label htmlFor={`k-${item.id}`}>Kind</label>
              <select id={`k-${item.id}`} className="input" value={f.kind} onChange={(e) => set("kind", e.target.value as typeof f.kind)}>
                {UPDATE_KINDS.map((k) => <option key={k} value={k}>{KIND_LABEL[k]}</option>)}
              </select>
            </div>
            <div className="field">
              <label htmlFor={`s-${item.id}`}>Status</label>
              <select id={`s-${item.id}`} className="input" value={f.status} onChange={(e) => set("status", e.target.value as typeof f.status)}>
                <option value="announced">Announced, not yet in effect</option>
                <option value="in_effect">In effect (verified)</option>
                <option value="ended">Ended or closed</option>
              </select>
            </div>
          </div>
          <div className="field"><label htmlFor={`t-${item.id}`}>Title</label><input id={`t-${item.id}`} className="input" value={f.title} maxLength={160} onChange={(e) => set("title", e.target.value)} /></div>
          <div className="field"><label htmlFor={`m-${item.id}`}>What changed, in plain words</label><textarea id={`m-${item.id}`} className="input" value={f.summary} maxLength={1200} onChange={(e) => set("summary", e.target.value)} /></div>
          <div className="grid-2">
            <div className="field"><label htmlFor={`j-${item.id}`}>Jurisdiction</label><input id={`j-${item.id}`} className="input" value={f.jurisdiction} onChange={(e) => set("jurisdiction", e.target.value)} /></div>
            <div className="field"><label htmlFor={`u-${item.id}`}>Official source</label><input id={`u-${item.id}`} className="input" type="url" value={f.sourceUrl} onChange={(e) => set("sourceUrl", e.target.value)} /></div>
            <div className="field"><label htmlFor={`a-${item.id}`}>Announced on</label><input id={`a-${item.id}`} className="input" type="date" value={f.announcedOn} onChange={(e) => set("announcedOn", e.target.value)} /></div>
            <div className="field"><label htmlFor={`e-${item.id}`}>Effective on</label><input id={`e-${item.id}`} className="input" type="date" value={f.effectiveOn} onChange={(e) => set("effectiveOn", e.target.value)} /></div>
          </div>
          <p className="small muted">If this changes a rule the engine uses (CRS points, eligibility, program status), the rule set or program record must also be updated in code with tests. Publishing here only informs users.</p>
          <div className="actions">
            <button type="submit" className="btn btn--ink btn--sm" disabled={pending} aria-busy={pending}>Publish</button>
            {item.id && <button type="button" className="linklike small" onClick={() => setMode("view")}>Back</button>}
          </div>
          <p className="small" aria-live="polite">{msg}</p>
        </form>
      )}
    </article>
  );
}
