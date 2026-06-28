import { supabaseServer } from "@/lib/supabase-server";

// Protected by middleware. Placeholder until the dashboard UI phase.
export default async function Dashboard() {
  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <main style={{ fontFamily: "system-ui, sans-serif", padding: "2rem", maxWidth: 720 }}>
      <h1>Dashboard</h1>
      <p>Signed in as <strong>{user?.email}</strong>.</p>
      <p style={{ color: "#666" }}>
        Session list and replay UI land in the frontend phase. The backend APIs under{" "}
        <code>/api/sessions</code> are already serving data.
      </p>
    </main>
  );
}
