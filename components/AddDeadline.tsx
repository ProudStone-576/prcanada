"use client";
import { useActionState } from "react";
import { addDeadlineAction } from "@/app/actions/deadlines";

export function AddDeadline() {
  const [state, action, pending] = useActionState(addDeadlineAction, {});
  return (
    <details>
      <summary className="linklike small">Add your own reminder</summary>
      <form action={action} className="form" style={{ marginTop: "var(--space-md)", gap: "var(--space-md)" }}>
        <div className="field">
          <label htmlFor="dl-title">What is due</label>
          <input id="dl-title" name="title" className="input" maxLength={120} required placeholder="For example: biometrics appointment" />
        </div>
        <div className="field">
          <label htmlFor="dl-date">Date</label>
          <input id="dl-date" name="dueDate" type="date" className="input" required />
        </div>
        {state.error && <p className="notice notice--error" role="alert">{state.error}</p>}
        {state.ok && <p className="notice notice--ok">{state.ok}</p>}
        <button type="submit" className="btn btn--card btn--sm" disabled={pending}>Add reminder</button>
      </form>
    </details>
  );
}
