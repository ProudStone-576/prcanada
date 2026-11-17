import Link from "next/link";
import { currentUser } from "@/lib/auth";
import { logoutAction } from "@/app/actions/auth";
import { NavLinks } from "./NavLinks";

export async function TopBar() {
  const user = await currentUser();
  const links = user
    ? [
        { href: "/dashboard", label: "Dashboard" },
        { href: "/assessment", label: "Assessment" },
        { href: "/crs", label: "CRS calculator" },
        { href: "/pathways", label: "PR pathways" },
        { href: "/history", label: "History" },
        { href: "/account", label: "Account" },
      ]
    : [
        { href: "/crs", label: "CRS calculator" },
        { href: "/pathways", label: "PR pathways" },
        { href: "/work-permits", label: "Work permits" },
        { href: "/updates", label: "Updates" },
        { href: "/login", label: "Sign in" },
      ];

  return (
    <header className="topbar">
      <div className="container topbar__in">
        <Link href={user ? "/dashboard" : "/"} className="wordmark" aria-label="PRPath Canada, home">
          PRPath <span>Canada</span>
        </Link>
        <nav className="topnav" aria-label="Main">
          <NavLinks links={links} />
          {user ? (
            <form action={logoutAction}>
              <button type="submit" className="btn btn--card btn--sm">Sign out</button>
            </form>
          ) : (
            <Link href="/signup" className="btn btn--ink btn--sm">Create account</Link>
          )}
        </nav>
        <details className="topnav__menu">
          <summary>Menu</summary>
          <div className="topnav__panel">
            <NavLinks links={links} />
            {user ? (
              <form action={logoutAction}>
                <button type="submit" className="linklike">Sign out</button>
              </form>
            ) : (
              <Link href="/signup">Create account</Link>
            )}
          </div>
        </details>
      </div>
    </header>
  );
}
