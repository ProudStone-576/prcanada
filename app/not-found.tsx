import Link from "next/link";

export default function NotFound() {
  return (
    <div className="container app-main">
      <h1 style={{ fontSize: "var(--text-3xl)" }}>We couldn&apos;t find that page.</h1>
      <p style={{ marginTop: "var(--space-md)" }}><Link href="/">Go to the home page</Link></p>
    </div>
  );
}
