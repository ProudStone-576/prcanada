"use client";

import { useState, useTransition } from "react";
import { applyToProfileAction, confirmDocumentAction, deleteDocumentAction } from "@/app/actions/documents";
import type { Finding } from "@/lib/documents/checks";
import { DOC_TYPES, DOC_TYPE_KEYS, type DocMeta, type DocType } from "@/lib/documents/types";

const kb = (n: number) => (n > 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} MB` : `${Math.ceil(n / 1024)} KB`);

export function DocumentItem({ doc, findings }: { doc: { id: string; docType: DocType; size: number; createdAt: string; meta: DocMeta }; findings: Finding[] }) {
  const s = doc.meta.suggested;
  const [type, setType] = useState<DocType>(doc.docType);
  const [issued, setIssued] = useState(doc.meta.confirmed.issuedOn ?? s.issuedOn ?? s.testDate ?? "");
  const [expires, setExpires] = useState(doc.meta.confirmed.expiresOn ?? s.expiresOn ?? "");
  const [msg, setMsg] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [pending, start] = useTransition();
  const run = (fn: () => Promise<{ error: string | null } | void>, done: string) =>
    start(async () => {
      const r = await fn();
      setMsg(r && r.error ? r.error : done);
    });

  const found: Array<[string, string]> = [];
  if (s.issuedOn) found.push(["Issued", s.issuedOn]);
  if (s.expiresOn) found.push(["Expires", s.expiresOn]);
  if (s.testDate) found.push(["Test date", s.testDate]);
  if (s.scores) found.push(["Scores", `L ${s.scores.listening ?? "?"}, R ${s.scores.reading ?? "?"}, W ${s.scores.writing ?? "?"}, S ${s.scores.speaking ?? "?"}`]);
  if (s.employer) found.push(["Employer", s.employer]);
  if (s.jobTitle) found.push(["Job title", s.jobTitle]);
  if (s.hoursPerWeek !== undefined) found.push(["Hours a week", String(s.hoursPerWeek)]);
  if (s.salary) found.push(["Salary", s.salary]);
  if (s.startDate) found.push(["Start date", s.startDate]);
  if (s.taxYear) found.push(["Tax year", s.taxYear]);
  if (s.province) found.push(["Province", s.province]);

  return (
    <details className="stock panel rec">
      <summary className="rec__sum">
        <span className="rec__name">{DOC_TYPES[doc.docType].label}</span>
        <span className="small muted">{doc.meta.filename}, {kb(doc.size)}, added {doc.createdAt}</span>
        {findings.some((f) => f.level === "problem") ? <span className="tag tag--urgent">Problem</span> : findings.length ? <span className="tag tag--soon">Check</span> : <span className="tag">No issues found</span>}
      </summary>
      <div className="rec__body">
        {findings.length > 0 && (
          <ul className="list small">
            {findings.map((f) => <li key={f.message} className={f.level === "problem" ? "delta-down" : ""}>{f.message}</li>)}
          </ul>
        )}
        {found.length > 0 && (
          <div>
            <h3 className="rec__h">What we read in it</h3>
            <dl className="kv small">
              {found.map(([k, v]) => (
                <div key={k}><dt>{k}</dt><dd className="fig">{v}</dd></div>
              ))}
            </dl>
            <p className="small muted">Read automatically from the text. Check each value against the document itself.</p>
          </div>
        )}
        {s.notes.length > 0 && <ul className="small">{s.notes.map((n) => <li key={n}>{n}</li>)}</ul>}

        <div className="grid-4">
          <div className="field">
            <label htmlFor={`t-${doc.id}`}>Type</label>
            <select id={`t-${doc.id}`} className="input" value={type} onChange={(e) => setType(e.target.value as DocType)}>
              {DOC_TYPE_KEYS.map((k) => <option key={k} value={k}>{DOC_TYPES[k].label}</option>)}
            </select>
          </div>
          <div className="field">
            <label htmlFor={`i-${doc.id}`}>{type === "language_test" ? "Test date" : "Issue date"}</label>
            <input id={`i-${doc.id}`} type="date" className="input" value={issued} onChange={(e) => setIssued(e.target.value)} />
          </div>
          {DOC_TYPES[type].hasExpiry && type !== "language_test" && type !== "eca" && (
            <div className="field">
              <label htmlFor={`e-${doc.id}`}>Expiry date</label>
              <input id={`e-${doc.id}`} type="date" className="input" value={expires} onChange={(e) => setExpires(e.target.value)} />
            </div>
          )}
        </div>
        <div className="actions">
          <button type="button" className="btn btn--card btn--sm" disabled={pending} onClick={() => run(() => confirmDocumentAction(doc.id, { docType: type, issuedOn: issued, expiresOn: expires }), "Saved.")}>Save these details</button>
          {(doc.docType === "work_permit" || doc.docType === "study_permit") && (s.expiresOn || doc.meta.confirmed.expiresOn) && (
            <button type="button" className="btn btn--card btn--sm" disabled={pending} onClick={() => run(() => applyToProfileAction(doc.id, "permit_expiry"), "Copied the permit dates to your profile.")}>Copy dates to profile</button>
          )}
          {doc.docType === "language_test" && s.scores && (
            <button type="button" className="btn btn--card btn--sm" disabled={pending} onClick={() => run(() => applyToProfileAction(doc.id, "language_scores"), "Copied the scores to your profile.")}>Copy scores to profile</button>
          )}
          <a className="btn btn--card btn--sm" href={`/api/documents/${doc.id}`}>Download</a>
          {confirmDelete ? (
            <>
              <button type="button" className="btn btn--card btn--sm btn--danger" disabled={pending} onClick={() => run(() => deleteDocumentAction(doc.id), "Deleted.")}>Delete permanently</button>
              <button type="button" className="linklike small" onClick={() => setConfirmDelete(false)}>Keep it</button>
            </>
          ) : (
            <button type="button" className="linklike small" onClick={() => setConfirmDelete(true)}>Delete</button>
          )}
        </div>
        <p className="small muted" aria-live="polite">{msg}</p>
      </div>
    </details>
  );
}
