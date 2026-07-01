// Small presentation helpers shared across dashboard pages.

export function statusBadgeClass(status: string): string {
  switch (status) {
    case "completed":
      return "green";
    case "active":
      return "blue";
    case "abandoned":
      return "amber";
    case "error":
      return "red";
    default:
      return "gray";
  }
}

export function severityClass(sev?: string): string {
  switch ((sev || "").toLowerCase()) {
    case "high":
      return "red";
    case "medium":
      return "amber";
    case "low":
      return "gray";
    default:
      return "gray";
  }
}

export function fmtDuration(sec?: number | null): string {
  if (!sec && sec !== 0) return "—";
  const m = Math.floor(sec / 60);
  const s = Math.round(sec % 60);
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

export function fmtDate(iso?: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function titleCase(s?: string | null): string {
  if (!s) return "—";
  return s.replace(/[_-]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}
