"use client";

import { useState } from "react";
import { fmtDate } from "@/lib/format";

type Annotation = { id: string; note: string; author: string | null; created_at: string };

export default function NotesPanel({
  sessionId,
  initial,
  authorLabel,
}: {
  sessionId: string;
  initial: Annotation[];
  authorLabel?: string | null;
}) {
  const [notes, setNotes] = useState<Annotation[]>(initial);
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!note.trim()) return;
    setSaving(true);
    setError(null);
    const res = await fetch(`/api/sessions/${sessionId}/annotations`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ note }),
    });
    setSaving(false);
    if (!res.ok) { setError("Failed to save note."); return; }
    const saved = await res.json();
    setNotes((prev) => [...prev, saved]);
    setNote("");
  }

  async function remove(id: string) {
    setNotes((prev) => prev.filter((n) => n.id !== id));
    await fetch(`/api/sessions/${sessionId}/annotations`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ annotationId: id }),
    });
  }

  return (
    <div className="notes-sidebar">
      <div className="notes-sidebar-h">
        <span className="notes-sidebar-title">
          Notes
          {notes.length > 0 && <span className="badge gray">{notes.length}</span>}
        </span>
      </div>

      <div className="notes-sidebar-list">
        {notes.length === 0
          ? <div className="empty notes-empty">No notes yet. Add the first QA note below.</div>
          : notes.map((n) => (
            <div className="note-row" key={n.id}>
              <div className="note-meta">
                <span className="note-author">{n.author || "QA"}</span>
                <span className="muted" style={{ fontSize: 12 }}>{fmtDate(n.created_at)}</span>
                <button className="note-del" onClick={() => remove(n.id)} title="Delete">×</button>
              </div>
              <div className="note-body">{n.note}</div>
            </div>
          ))}
      </div>

      <form className="notes-sidebar-compose" onSubmit={submit}>
        <div className="notes-compose-box">
          <textarea
            className="note-area"
            placeholder="Add a QA note — observations, false positive flags, follow-up actions…"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={3}
          />
          <div className="note-footer">
            {authorLabel && (
              <span className="muted" style={{ fontSize: 12, marginLeft: 8 }}>
                Posting as {authorLabel}
              </span>
            )}
            <button type="submit" className="btn btn-primary" disabled={saving || !note.trim()} style={{ marginLeft: "auto" }}>
              {saving ? "Saving…" : "Add note"}
            </button>
          </div>
        </div>
        {error && <p style={{ color: "crimson", fontSize: 13, margin: "8px 0 0" }}>{error}</p>}
      </form>
    </div>
  );
}
