import { supabaseServer } from "@/lib/supabase-server";
import AppShell from "@/components/AppShell";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return <AppShell email={user?.email ?? ""}>{children}</AppShell>;
}
