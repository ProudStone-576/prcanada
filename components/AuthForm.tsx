"use client";
import { useActionState } from "react";
import type { FormState } from "@/app/actions/auth";

type Field = { name: string; label: string; type?: string; autoComplete?: string; hint?: string };

export function AuthForm({
  action,
  fields,
  submit,
  hidden,
  children,
  tone = "ink",
}: {
  action: (s: FormState, f: FormData) => Promise<FormState>;
  fields: Field[];
  submit: string;
  hidden?: Record<string, string>;
  children?: React.ReactNode;
  tone?: "ink" | "danger";
}) {
  const [state, formAction, pending] = useActionState(action, {});
  return (
    <form action={formAction} className="form" noValidate>
      {hidden && Object.entries(hidden).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
      {fields.map((f) => (
        <div className="field" key={f.name}>
          <label htmlFor={f.name}>{f.label}</label>
          <input
            id={f.name}
            name={f.name}
            className="input"
            type={f.type ?? "text"}
            autoComplete={f.autoComplete}
            defaultValue={state.fields?.[f.name]}
            required
          />
          {f.hint && <p className="hint">{f.hint}</p>}
        </div>
      ))}
      {children}
      <div aria-live="polite">
        {state.error && <p className="notice notice--error" role="alert">{state.error}</p>}
        {state.ok && <p className="notice notice--ok">{state.ok}</p>}
      </div>
      <button type="submit" className={tone === "ink" ? "btn btn--ink btn--lg" : "btn btn--card btn--lg btn--danger"} disabled={pending} aria-busy={pending}>
        {pending ? "Please wait" : submit}
      </button>
    </form>
  );
}
