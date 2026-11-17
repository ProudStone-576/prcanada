"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { DOC_TYPES, DOC_TYPE_KEYS, MAX_BYTES } from "@/lib/documents/types";

export function DocumentUpload({ defaultType }: { defaultType?: string }) {
  const router = useRouter();
  const form = useRef<HTMLFormElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setOk(null);
    const data = new FormData(e.currentTarget);
    const file = data.get("file");
    if (!(file instanceof File) || !file.size) return setError("Choose a file to upload.");
    if (file.size > MAX_BYTES) return setError("Files must be 10 MB or smaller.");
    if (data.get("consent") !== "on") return setError("Please confirm you agree to us storing and reading this document.");
    setBusy(true);
    try {
      const res = await fetch("/api/documents", { method: "POST", body: data });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) return setError(body.error ?? "Upload failed. Try again.");
      setOk(body.textStatus === "extracted" ? "Uploaded. We read the text and listed what we found below for you to check." : "Uploaded. We couldn't read text from it (scans and photos have none), so add its dates by hand below.");
      form.current?.reset();
      router.refresh();
    } catch {
      setError("Upload failed. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form ref={form} className="form stock panel" onSubmit={submit} noValidate>
      <h2>Add a document</h2>
      <div className="grid-2">
        <div className="field">
          <label htmlFor="doc-type">What is it?</label>
          <select id="doc-type" name="docType" className="input" defaultValue={defaultType ?? ""} required>
            <option value="" disabled>Choose one</option>
            {DOC_TYPE_KEYS.map((k) => <option key={k} value={k}>{DOC_TYPES[k].label}</option>)}
          </select>
        </div>
        <div className="field">
          <label htmlFor="doc-file">File</label>
          <input id="doc-file" name="file" type="file" className="input" accept="application/pdf,image/png,image/jpeg" required />
          <p className="hint">PDF, PNG or JPEG, up to 10 MB.</p>
        </div>
      </div>
      <label className="check">
        <input type="checkbox" name="consent" />
        <span>I agree to PRPath Canada storing this document, encrypted, and reading its text to check it against my profile. Nothing is changed in the document, and I can delete it at any time.</span>
      </label>
      <div aria-live="polite">
        {error && <p className="notice notice--error" role="alert">{error}</p>}
        {ok && <p className="notice notice--ok">{ok}</p>}
      </div>
      <div className="actions">
        <button type="submit" className="btn btn--ink" disabled={busy} aria-busy={busy}>{busy ? "Uploading" : "Upload"}</button>
      </div>
    </form>
  );
}
