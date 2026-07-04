import { notFound } from "next/navigation";
import { authorFromEmail } from "@/lib/author";
import { getSessionDetail } from "@/lib/data";
import { supabaseServer } from "@/lib/supabase-server";
import SessionView from "@/components/SessionView";

export const dynamic = "force-dynamic";

export default async function SessionDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [d, supabase] = await Promise.all([getSessionDetail(id), supabaseServer()]);
  if (!d) notFound();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  const agentName = (d.session as any).agent_name || "Agent";
  const authorLabel = authorFromEmail(user?.email);

  return <SessionView data={d} agentName={agentName} authorLabel={authorLabel} />;
}
