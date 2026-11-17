"use client";
import { useId } from "react";

type Base = { label: React.ReactNode; hint?: React.ReactNode; error?: string };

export function TextField({ value, onChange, type = "text", autoComplete, inputMode, ...b }: Base & {
  value?: string | number;
  onChange: (v: string) => void;
  type?: string;
  autoComplete?: string;
  inputMode?: React.HTMLAttributes<HTMLInputElement>["inputMode"];
}) {
  const id = useId();
  return (
    <div className="field">
      <label htmlFor={id}>{b.label}</label>
      <input
        id={id}
        className="input"
        type={type}
        value={value ?? ""}
        autoComplete={autoComplete ?? "off"}
        inputMode={inputMode}
        aria-invalid={b.error ? true : undefined}
        aria-describedby={b.hint ? id + "-h" : undefined}
        onChange={(e) => onChange(e.target.value)}
      />
      {b.hint && <p className="hint" id={id + "-h"}>{b.hint}</p>}
      {b.error && <p className="err">{b.error}</p>}
    </div>
  );
}

export function NumberField({ value, onChange, step = 1, min, max, ...b }: Base & {
  value?: number;
  onChange: (v: number | undefined) => void;
  step?: number;
  min?: number;
  max?: number;
}) {
  const id = useId();
  return (
    <div className="field">
      <label htmlFor={id}>{b.label}</label>
      <input
        id={id}
        className="input fig"
        type="number"
        inputMode="decimal"
        step={step}
        min={min}
        max={max}
        value={value ?? ""}
        aria-invalid={b.error ? true : undefined}
        onChange={(e) => onChange(e.target.value === "" ? undefined : Number(e.target.value))}
      />
      {b.hint && <p className="hint">{b.hint}</p>}
      {b.error && <p className="err">{b.error}</p>}
    </div>
  );
}

export function TextArea({ value, onChange, ...b }: Base & { value?: string; onChange: (v: string) => void }) {
  const id = useId();
  return (
    <div className="field">
      <label htmlFor={id}>{b.label}</label>
      <textarea id={id} className="input" value={value ?? ""} onChange={(e) => onChange(e.target.value)} />
      {b.hint && <p className="hint">{b.hint}</p>}
      {b.error && <p className="err">{b.error}</p>}
    </div>
  );
}

export function SelectField<T extends string>({ value, onChange, options, placeholder = "Choose one", ...b }: Base & {
  value?: T;
  onChange: (v: T | undefined) => void;
  options: Array<[T, string]>;
  placeholder?: string;
}) {
  const id = useId();
  return (
    <div className="field">
      <label htmlFor={id}>{b.label}</label>
      <select id={id} className="input" value={value ?? ""} onChange={(e) => onChange((e.target.value || undefined) as T | undefined)}>
        <option value="">{placeholder}</option>
        {options.map(([v, l]) => (
          <option key={v} value={v}>{l}</option>
        ))}
      </select>
      {b.hint && <p className="hint">{b.hint}</p>}
      {b.error && <p className="err">{b.error}</p>}
    </div>
  );
}

export function Choice<T extends string>({ value, onChange, options, ...b }: Base & {
  value?: T;
  onChange: (v: T) => void;
  options: Array<[T, string]>;
}) {
  const name = useId();
  return (
    <fieldset className="field">
      <legend className="label" style={{ marginBottom: "var(--space-2xs)" }}>{b.label}</legend>
      <div className="choices">
        {options.map(([v, l]) => (
          <label className="choice" key={v}>
            <input type="radio" name={name} value={v} checked={value === v} onChange={() => onChange(v)} />
            <span>{l}</span>
          </label>
        ))}
      </div>
      {b.hint && <p className="hint">{b.hint}</p>}
      {b.error && <p className="err">{b.error}</p>}
    </fieldset>
  );
}

export const YES_NO: Array<["yes" | "no" | "unsure", string]> = [
  ["yes", "Yes"],
  ["no", "No"],
  ["unsure", "Not sure"],
];

export function Check({ checked, onChange, children }: { checked?: boolean; onChange: (v: boolean) => void; children: React.ReactNode }) {
  return (
    <label className="check">
      <input type="checkbox" checked={Boolean(checked)} onChange={(e) => onChange(e.target.checked)} />
      <span>{children}</span>
    </label>
  );
}
