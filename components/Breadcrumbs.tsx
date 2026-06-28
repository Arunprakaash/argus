"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useBreadcrumbTail } from "./breadcrumb-context";

export default function Breadcrumbs() {
  const path = usePathname();
  const { tail } = useBreadcrumbTail();
  const onSessionDetail = /^\/dashboard\/sessions\/.+/.test(path);
  const onIntegrations = path.startsWith("/dashboard/integrations");
  const onFunctions = path.startsWith("/dashboard/functions");

  return (
    <div className="crumb">
      {onSessionDetail ? (
        <>
          <Link href="/dashboard">Sessions</Link>
          <span className="sep">/</span>
          <b>{tail || "Session"}</b>
        </>
      ) : onIntegrations ? (
        <b>Integrations</b>
      ) : onFunctions ? (
        <b>Functions</b>
      ) : (
        <b>Sessions</b>
      )}
    </div>
  );
}
