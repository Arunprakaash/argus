/** Warm TCP/TLS to the video CDN/origin before the browser requests bytes. */
export function preconnectVideoOrigin(url: string): () => void {
  let origin: string;
  try {
    origin = new URL(url).origin;
  } catch {
    return () => {};
  }

  const links: HTMLLinkElement[] = [];
  for (const rel of ["dns-prefetch", "preconnect"] as const) {
    const link = document.createElement("link");
    link.rel = rel;
    link.href = origin;
    if (rel === "preconnect") link.crossOrigin = "anonymous";
    document.head.appendChild(link);
    links.push(link);
  }

  return () => {
    for (const link of links) link.remove();
  };
}
