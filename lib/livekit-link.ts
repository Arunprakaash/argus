/** Build a LiveKit Cloud session URL: {project}/sessions/RM_… */
export function livekitSessionUrl(projectBase: string, livekitSessionId: string): string | null {
  if (!projectBase || !livekitSessionId) return null;
  // Accept full pasted URLs — keep only the project root.
  const base = projectBase
    .replace(/\/$/, "")
    .replace(/\/sessions(?:\/.*)?$/, "");
  return `${base}/sessions/${livekitSessionId}`;
}
