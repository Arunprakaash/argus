"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useCallback, useTransition } from "react";

const STATUSES = [
  { value: "", label: "All" },
  { value: "active", label: "Active" },
  { value: "completed", label: "Completed" },
  { value: "abandoned", label: "Abandoned" },
];

const PERIODS = [
  { value: "all", label: "All time" },
  { value: "today", label: "Today" },
  { value: "7d", label: "7 days" },
  { value: "30d", label: "30 days" },
];

export default function SessionsFilter() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [, startTransition] = useTransition();

  const q = params.get("q") ?? "";
  const status = params.get("status") ?? "";
  const period = params.get("period") ?? "all";

  const push = useCallback(
    (updates: Record<string, string>) => {
      const next = new URLSearchParams(params.toString());
      for (const [k, v] of Object.entries(updates)) {
        if (!v || v === "all" || v === "") next.delete(k);
        else next.set(k, v);
      }
      next.delete("page"); // reset to page 1 on filter change
      startTransition(() => router.push(`${pathname}?${next.toString()}`));
    },
    [params, pathname, router],
  );

  return (
    <div className="filter-bar">
      {/* Search */}
      <input
        className="filter-search"
        type="search"
        placeholder="Search candidate or room…"
        defaultValue={q}
        onChange={(e) => push({ q: e.target.value })}
      />

      {/* Status pills */}
      <div className="filter-pills">
        {STATUSES.map((s) => (
          <button
            key={s.value}
            className={`pill${status === s.value ? " active" : ""}`}
            onClick={() => push({ status: s.value })}
          >
            {s.label}
          </button>
        ))}
      </div>

      {/* Period select */}
      <select
        className="filter-select"
        value={period}
        onChange={(e) => push({ period: e.target.value })}
      >
        {PERIODS.map((p) => (
          <option key={p.value} value={p.value}>{p.label}</option>
        ))}
      </select>
    </div>
  );
}
