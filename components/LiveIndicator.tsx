"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase-browser";

export default function LiveIndicator({ initial }: { initial: number }) {
  const [count, setCount] = useState(initial);
  const router = useRouter();

  useEffect(() => {
    const sb = supabaseBrowser();
    const channel = sb
      .channel("sessions-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "sessions" }, () => {
        sb.from("sessions")
          .select("id", { count: "exact", head: true })
          .eq("status", "active")
          .then(({ count }) => {
            setCount(count ?? 0);
            router.refresh();
          });
      })
      .subscribe();
    return () => { sb.removeChannel(channel); };
  }, [router]);

  if (count === 0) return null;

  return (
    <div className="live-banner">
      <span className="live-dot" />
      {count} session{count !== 1 ? "s" : ""} in progress
    </div>
  );
}
