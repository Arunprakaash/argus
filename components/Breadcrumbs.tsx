"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useBreadcrumbTail } from "./breadcrumb-context";

export default function Breadcrumbs() {
  const path = usePathname();
  const { tail } = useBreadcrumbTail();
  const onDetail = /^\/dashboard\/sessions\/.+/.test(path);

  return (
    <div className="crumb">
      {onDetail ? (
        <>
          <Link href="/dashboard">Sessions</Link>
          <span className="sep">/</span>
          <b>{tail || "Session"}</b>
        </>
      ) : (
        <b>Sessions</b>
      )}
    </div>
  );
}
