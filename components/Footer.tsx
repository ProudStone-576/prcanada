import Link from "next/link";
import { OFFICIAL } from "@/lib/sources";

export function Footer() {
  return (
    <footer className="footer">
      <div className="container">
        <div className="footer__grid">
          <div>
            <p className="wordmark">PRPath <span>Canada</span></p>
            <p style={{ marginTop: "var(--space-sm)", maxWidth: "46ch" }}>
              Information, not legal advice. We are not licensed consultants, lawyers or the Government of Canada, and we can&apos;t promise outcomes.
            </p>
          </div>
          <div>
            <p className="label" style={{ marginBottom: "var(--space-sm)" }}>Official sources</p>
            <ul className="footer__sources">
              {OFFICIAL.map((s) => (
                <li key={s.url}>
                  <a href={s.url} rel="noopener noreferrer" target="_blank">{s.label}</a>
                </li>
              ))}
            </ul>
          </div>
        </div>
        <div className="footer__legal">
          <Link href="/disclaimer">Disclaimer</Link>
          <Link href="/privacy">Privacy policy</Link>
          <Link href="/terms">Terms of use</Link>
          <a href="https://college-ic.ca/protecting-the-public/find-an-immigration-consultant" rel="noopener noreferrer" target="_blank">Find a licensed consultant (CICC)</a>
        </div>
      </div>
    </footer>
  );
}
