"use client";

import Link from "next/link";
import Breadcrumbs from "./Breadcrumbs";
import SignOutButton from "./SignOutButton";
import { BreadcrumbProvider } from "./breadcrumb-context";

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
              <Link href="/dashboard" className="active">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="8" y1="6" x2="21" y2="6" />
                  <line x1="8" y1="12" x2="21" y2="12" />
                  <line x1="8" y1="18" x2="21" y2="18" />
                  <line x1="3.5" y1="6" x2="3.51" y2="6" />
                  <line x1="3.5" y1="12" x2="3.51" y2="12" />
                  <line x1="3.5" y1="18" x2="3.51" y2="18" />
                </svg>
                Sessions
              </Link>
            </nav>
          </aside>
          <main className="content-wrap">{children}</main>
        </div>
      </div>
    </BreadcrumbProvider>
  );
}
