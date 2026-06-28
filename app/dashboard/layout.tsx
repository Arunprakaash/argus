import Link from "next/link";
import { supabaseServer } from "@/lib/supabase-server";
import SignOutButton from "@/components/SignOutButton";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand">
          <span className="logo" />
          Interview Observer
        </div>
        <nav className="nav">
          <Link href="/dashboard" className="active">📋 Sessions</Link>
        </nav>
        <div className="spacer" />
        <div className="foot">Observability & QA for the LiveKit interview agent.</div>
      </aside>

      <div className="main">
        <header className="topbar">
          <div className="crumb">
            <b>Sessions</b>
          </div>
          <div className="row">
            <span className="muted" style={{ fontSize: 13 }}>{user?.email}</span>
            <SignOutButton />
          </div>
        </header>
        <div className="content">{children}</div>
      </div>
    </div>
  );
}
