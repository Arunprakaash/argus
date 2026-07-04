"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { fmtDate } from "@/lib/format";

const TOOL_LABELS: Record<string, string> = {
  handle_out_of_context: "Out of context",
  handle_profanity: "Profanity detected",
  handle_prompt_injection: "Prompt injection attempt",
  postpone_interview: "Candidate tried to postpone",
  complete_interview: "Interview completed",
};
const TOOL_COLOR = "#556c72";

type MergedItem =
  | { _kind: "turn"; id: string; role: string; text: string; ts: string; interrupted?: boolean }
  | { _kind: "tool"; _idx: number; ts: string; name: string; args: unknown; output: unknown };

function itemKey(item: MergedItem): string {
  return item._kind === "turn" ? item.id : `tool-${item._idx}`;
}

function mergeTranscript(transcript: { id: string; role: string; text: string; ts: string; interrupted?: boolean }[], toolEvents: { ts: string; payload?: { function_calls?: { name?: string; arguments?: unknown }[]; function_call_outputs?: unknown[] } }[]): MergedItem[] {
  const toolItems: Extract<MergedItem, { _kind: "tool" }>[] = [];
  let idx = 0;
  for (const ev of toolEvents) {
    const calls = ev.payload?.function_calls ?? [];
    const outputs = ev.payload?.function_call_outputs ?? [];
    calls.forEach((c, i) => {
      toolItems.push({
        _kind: "tool",
        _idx: idx++,
        ts: ev.ts,
        name: c.name ?? "",
        args: c.arguments ?? null,
        output: outputs[i] ?? null,
      });
    });
  }
  return [
    ...transcript.map((t) => ({ _kind: "turn" as const, ...t })),
    ...toolItems,
  ].sort((a, b) => new Date(a.ts).getTime() - new Date(b.ts).getTime());
}

function anchorMs(startedAt: string | null, merged: MergedItem[]): number {
  if (startedAt) return new Date(startedAt).getTime();
  if (merged.length === 0) return 0;
  return new Date(merged[0].ts).getTime();
}

function tsToOffsetSec(ts: string, anchor: number): number {
  return Math.max(0, (new Date(ts).getTime() - anchor) / 1000);
}

/** Offset where an item's spoken/active window begins (previous item end, or 0). */
function itemStartSec(merged: MergedItem[], index: number, anchor: number): number {
  if (index <= 0) return 0;
  return tsToOffsetSec(merged[index - 1].ts, anchor);
}

function activeKeyAtTime(merged: MergedItem[], anchor: number, currentSec: number): string | null {
  if (merged.length === 0) return null;
  for (let i = 0; i < merged.length; i++) {
    const start = itemStartSec(merged, i, anchor);
    const end = tsToOffsetSec(merged[i].ts, anchor);
    if (currentSec >= start && currentSec < end) return itemKey(merged[i]);
  }
  return itemKey(merged[merged.length - 1]);
}

function scrollRowToTop(container: HTMLDivElement, row: HTMLElement) {
  const top = row.getBoundingClientRect().top - container.getBoundingClientRect().top + container.scrollTop;
  container.scrollTo({ top, behavior: "smooth" });
}

function ToolCallRow({ item, active }: { item: Extract<MergedItem, { _kind: "tool" }>; active: boolean }) {
  const [open, setOpen] = useState(false);
  const c = TOOL_COLOR;
  return (
    <div className={`replay-tool${active ? " active" : ""}`} data-replay-key={itemKey(item)}>
      <div
        onClick={() => setOpen((o) => !o)}
        style={{
          display: "flex", alignItems: "center", gap: 10,
          padding: "8px 14px", cursor: "pointer",
          background: open ? `${c}35` : `${c}20`,
          fontSize: 12,
        }}
      >
        <span style={{ color: c, fontSize: 11, fontWeight: 700, letterSpacing: "0.05em", textTransform: "uppercase", flexShrink: 0 }}>Tool call</span>
        <span style={{ fontFamily: "var(--mono)", fontSize: 12, color: "var(--text)" }}>{TOOL_LABELS[item.name] ?? item.name}</span>
        <span className="ts" style={{ marginLeft: "auto" }}>{fmtDate(item.ts)}</span>
        <span style={{ color: "var(--muted)", fontSize: 10 }}>{open ? "▲" : "▼"}</span>
      </div>
      {open && (
        <div style={{ background: `${c}0d`, borderTop: `1px solid ${c}30`, padding: "10px 14px", display: "flex", flexDirection: "column", gap: 8 }}>
          {item.args != null && (
            <div>
              <div style={{ fontSize: 10, textTransform: "uppercase", color: "var(--muted)", marginBottom: 3, letterSpacing: "0.06em" }}>Arguments</div>
              <pre style={{ margin: 0, fontFamily: "var(--mono)", fontSize: 11, whiteSpace: "pre-wrap", wordBreak: "break-all", color: "var(--text)", background: "var(--bg)", padding: "8px", border: "1px solid var(--border)" }}>
                {typeof item.args === "string" ? item.args : JSON.stringify(item.args, null, 2)}
              </pre>
            </div>
          )}
          {item.output != null && (
            <div>
              <div style={{ fontSize: 10, textTransform: "uppercase", color: "var(--muted)", marginBottom: 3, letterSpacing: "0.06em" }}>Output</div>
              <pre style={{ margin: 0, fontFamily: "var(--mono)", fontSize: 11, whiteSpace: "pre-wrap", wordBreak: "break-all", color: "var(--text)", background: "var(--bg)", padding: "8px", border: "1px solid var(--border)" }}>
                {typeof item.output === "string" ? item.output : JSON.stringify(item.output, null, 2)}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function TranscriptReplayPanel({
  sessionId,
  videoUrl: initialVideoUrl,
  expiresInSec = 600,
  transcript,
  toolEvents,
  startedAt,
}: {
  sessionId: string;
  videoUrl: string;
  expiresInSec?: number;
  transcript: { id: string; role: string; text: string; ts: string; interrupted?: boolean }[];
  toolEvents: { ts: string; payload?: { function_calls?: { name?: string; arguments?: unknown }[]; function_call_outputs?: unknown[] } }[];
  startedAt: string | null;
}) {
  const merged = useMemo(() => mergeTranscript(transcript, toolEvents), [transcript, toolEvents]);
  const anchor = useMemo(() => anchorMs(startedAt, merged), [startedAt, merged]);

  const videoRef = useRef<HTMLVideoElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const rowRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const scrollLockUntil = useRef(0);
  const lastActiveRef = useRef<string | null>(null);
  const pendingSeek = useRef<{ time: number; play: boolean } | null>(null);

  const [videoUrl, setVideoUrl] = useState(initialVideoUrl);
  const [activeKey, setActiveKey] = useState<string | null>(null);

  useEffect(() => {
    setVideoUrl(initialVideoUrl);
  }, [initialVideoUrl]);

  const refreshVideoUrl = useCallback(async () => {
    const video = videoRef.current;
    if (!video) return;
    pendingSeek.current = { time: video.currentTime, play: !video.paused };
    const res = await fetch(`/api/sessions/${sessionId}/interview-recording`);
    if (!res.ok) return;
    const data = await res.json();
    if (!data?.url) return;
    setVideoUrl(data.url);
  }, [sessionId]);

  const onVideoLoaded = useCallback(() => {
    const video = videoRef.current;
    const pending = pendingSeek.current;
    if (!video || !pending) return;
    video.currentTime = pending.time;
    pendingSeek.current = null;
    if (pending.play) void video.play();
  }, []);

  useEffect(() => {
    const refreshMs = Math.max(60_000, (expiresInSec - 60) * 1000);
    const timer = setInterval(() => { void refreshVideoUrl(); }, refreshMs);
    return () => clearInterval(timer);
  }, [expiresInSec, refreshVideoUrl]);

  useEffect(() => {
    if (!activeKey || activeKey === lastActiveRef.current) return;
    if (Date.now() < scrollLockUntil.current) return;
    lastActiveRef.current = activeKey;
    const container = scrollRef.current;
    const row = rowRefs.current.get(activeKey);
    if (container && row) scrollRowToTop(container, row);
  }, [activeKey]);

  const onTimeUpdate = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    setActiveKey(activeKeyAtTime(merged, anchor, video.currentTime));
  }, [merged, anchor]);

  const seekToTurn = useCallback((item: Extract<MergedItem, { _kind: "turn" }>) => {
    const video = videoRef.current;
    if (!video) return;
    const index = merged.findIndex((m) => m._kind === "turn" && m.id === item.id);
    video.currentTime = index >= 0 ? itemStartSec(merged, index, anchor) : tsToOffsetSec(item.ts, anchor);
    void video.play();
    setActiveKey(item.id);
  }, [merged, anchor]);

  if (merged.length === 0) return <div className="empty">No transcript.</div>;

  return (
    <div className="replay-split">
      <div className="replay-video-col">
        <div className="replay-video-label">Interview recording</div>
        <video
          ref={videoRef}
          src={videoUrl}
          controls
          preload="auto"
          playsInline
          // @ts-expect-error fetchPriority is valid on video in modern browsers
          fetchPriority="high"
          className="replay-video"
          onTimeUpdate={onTimeUpdate}
          onLoadedData={onVideoLoaded}
        />
      </div>
      <div
        className="replay-transcript-col"
        ref={scrollRef}
        onScroll={() => { scrollLockUntil.current = Date.now() + 2000; }}
      >
        <div className="transcript replay-transcript">
          {merged.map((item) => {
            if (item._kind === "turn") {
              const key = itemKey(item);
              const isActive = activeKey === key;
              return (
                <div
                  key={key}
                  ref={(el) => { if (el) rowRefs.current.set(key, el); else rowRefs.current.delete(key); }}
                  data-replay-key={key}
                  className={`turn turn-seekable ${item.role}${item.interrupted ? " interrupted" : ""}${isActive ? " active" : ""}`}
                  onClick={() => seekToTurn(item)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); seekToTurn(item); } }}
                >
                  <div className="avatar">{(item.role === "assistant" ? "A" : "C")}</div>
                  <div className="turn-body">
                    <div className="turn-role">{item.role === "assistant" ? "Agent" : "Candidate"}</div>
                    <div className="txt">{item.text}</div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <div className="ts" suppressHydrationWarning>{fmtDate(item.ts)}</div>
                      {item.interrupted && (
                        <span style={{ fontSize: 10, color: "var(--muted)", letterSpacing: "0.04em", textTransform: "uppercase" }}>interrupted</span>
                      )}
                    </div>
                  </div>
                </div>
              );
            }
            return (
              <div
                key={itemKey(item)}
                ref={(el) => {
                  const k = itemKey(item);
                  if (el) rowRefs.current.set(k, el);
                  else rowRefs.current.delete(k);
                }}
              >
                <ToolCallRow item={item} active={activeKey === itemKey(item)} />
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
