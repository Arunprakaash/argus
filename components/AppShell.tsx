"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import Breadcrumbs from "./Breadcrumbs";
import SignOutButton from "./SignOutButton";
import { BreadcrumbProvider } from "./breadcrumb-context";

function NavLink({ href, label, children }: { href: string; label: string; children: React.ReactNode }) {
  const pathname = usePathname();
  const active = href === "/dashboard" ? pathname === "/dashboard" || pathname.startsWith("/dashboard/sessions") : pathname.startsWith(href);
  return (
    <Link href={href} className={active ? "active" : ""}>
      {children}
      {label}
    </Link>
  );
}

export default function AppShell({ email, children }: { email: string; children: React.ReactNode }) {
  return (
    <BreadcrumbProvider>
      <div className="app">
        <header className="topbar">
          <div className="row">
            <span className="brand-t">Argus</span>
            <span className="sep">/</span>
            <Breadcrumbs />
          </div>
          <div className="row">
            <span className="muted" style={{ fontSize: 13 }}>{email}</span>
            <SignOutButton />
          </div>
        </header>

        <div className="below">
          <aside className="sidebar">
            <nav className="nav">
              <NavLink href="/dashboard" label="Sessions">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="8" y1="6" x2="21" y2="6" /><line x1="8" y1="12" x2="21" y2="12" /><line x1="8" y1="18" x2="21" y2="18" />
                  <line x1="3.5" y1="6" x2="3.51" y2="6" /><line x1="3.5" y1="12" x2="3.51" y2="12" /><line x1="3.5" y1="18" x2="3.51" y2="18" />
                </svg>
              </NavLink>
              <NavLink href="/dashboard/integrations" label="Integrations">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                  <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
                </svg>
              </NavLink>
            </nav>
          </aside>
          <main className="content-wrap">{children}</main>
        </div>
      </div>
    </BreadcrumbProvider>
  );
}
