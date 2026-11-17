import { useId } from "react";
import { GLOSSARY, type GlossaryKey } from "@/lib/glossary";

/** A term with a plain-language definition: hover shows it after a delay, focus shows it at once. */
export function Term({ k, children }: { k: GlossaryKey; children: React.ReactNode }) {
  const id = useId();
  return (
    <span className="term">
      <button type="button" className="term__btn" aria-describedby={id}>
        {children}
      </button>
      <span id={id} className="term__tip" aria-hidden="true">
        {GLOSSARY[k]}
      </span>
    </span>
  );
}
