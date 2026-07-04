export function authorFromEmail(email: string | null | undefined): string | null {
  if (!email?.includes("@")) return null;
  const local = email.split("@")[0]?.trim();
  return local || null;
}
