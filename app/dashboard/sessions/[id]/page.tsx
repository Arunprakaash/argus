import { notFound } from "next/navigation";
import { getSessionDetail } from "@/lib/data";
import SessionView from "@/components/SessionView";

export const dynamic = "force-dynamic";

export default async function SessionDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const d = await getSessionDetail(id);
  if (!d) notFound();
  const agentName = (d.session as any).agent_name || "Agent";
  return <SessionView data={d} agentName={agentName} />;
}
