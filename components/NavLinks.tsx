"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

export function NavLinks({ links }: { links: Array<{ href: string; label: string }> }) {
  const path = usePathname();
  return (
    <>
      {links.map((l) => (
        <Link key={l.href} href={l.href} aria-current={path === l.href || path.startsWith(l.href + "/") ? "page" : undefined}>
          {l.label}
        </Link>
      ))}
    </>
  );
}
