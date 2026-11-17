import Link from "next/link";

export const metadata = { title: "Terms of use" };

export default function Terms() {
  return (
    <div className="container app-main prose">
      <h1 style={{ fontSize: "var(--text-3xl)", marginBottom: "var(--space-sm)" }}>Terms of use</h1>
      <p className="muted">Version 2026-11-17.</p>
      <h2>The service</h2>
      <p>PRPath Canada gives general information about Canadian immigration and tools to estimate scores and organize your plans. Read the <Link href="/disclaimer">disclaimer</Link>: it is part of these terms.</p>
      <h2>Your responsibilities</h2>
      <ul>
        <li>Give accurate answers. Results are only as good as the information entered.</li>
        <li>Check every result against the official source before you act on it.</li>
        <li>Keep your password private. You are responsible for activity on your account.</li>
        <li>Don&apos;t try to access anyone else&apos;s account or data.</li>
      </ul>
      <h2>What we don&apos;t do</h2>
      <p>We don&apos;t provide legal representation, submit applications, or guarantee any outcome. Nothing here creates a client relationship with a consultant or lawyer. If paid professional services are ever offered, they will be provided by authorized representatives under a separate agreement.</p>
      <h2>Liability</h2>
      <p>To the extent the law allows, we are not liable for decisions you make based on the information here. Immigration rules change and authorities decide every case on its own facts.</p>
      <h2>Changes</h2>
      <p>If these terms change, we&apos;ll show the new version and its date, and ask you to agree again where the law requires it.</p>
    </div>
  );
}
