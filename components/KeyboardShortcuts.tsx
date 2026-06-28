"use client";

import { useEffect, useState } from "react";

const SHORTCUTS = [
  { keys: ["?"], description: "Show shortcuts" },
  { keys: ["/"], description: "Focus search" },
  { keys: ["j"], description: "Next session row" },
  { keys: ["k"], description: "Previous session row" },
  { keys: ["Enter"], description: "Open selected session" },
  { keys: ["Esc"], description: "Back / clear" },
  { keys: ["1–6"], description: "Switch tab in session detail" },
];

export default function KeyboardShortcuts() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    function handler(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement).tagName;
      const typing = tag === "INPUT" || tag === "TEXTAREA" || (e.target as HTMLElement).isContentEditable;

      if (e.key === "Escape") { setOpen(false); return; }
      if (typing) return;

      if (e.key === "?") { e.preventDefault(); setOpen((o) => !o); return; }

      if (e.key === "/") {
        e.preventDefault();
        const search = document.querySelector<HTMLInputElement>(".filter-search");
        search?.focus();
        return;
      }
    }
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  if (!open) return null;

  return (
    <div className="shortcuts-backdrop" onClick={() => setOpen(false)}>
      <div className="shortcuts-modal" onClick={(e) => e.stopPropagation()}>
        <h2>Keyboard shortcuts</h2>
        {SHORTCUTS.map((s) => (
          <div className="shortcut-row" key={s.keys.join()}>
            <span>{s.description}</span>
            <div style={{ display: "flex", gap: 4 }}>
              {s.keys.map((k) => <kbd key={k}>{k}</kbd>)}
            </div>
          </div>
        ))}
        <div style={{ marginTop: 16, fontSize: 12, color: "var(--muted)" }}>Press <kbd>?</kbd> or Esc to close</div>
      </div>
    </div>
  );
}
