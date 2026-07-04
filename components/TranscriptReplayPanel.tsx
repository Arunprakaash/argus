"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { fmtDate, fmtTimecode, titleCase } from "@/lib/format";
import { FLAG_TOOL_TO_TYPE } from "@/lib/schema";

type ReplayFlag = { id: string | number; type: string; ts: string };
type TimelineMarker = { id: string; label: string; ts: string; vision?: boolean };

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

function safePlay(video: HTMLVideoElement) {
  void video.play().catch((err: unknown) => {
    if (err instanceof DOMException && err.name === "AbortError") return;
  });
}

function seekVideo(video: HTMLVideoElement, sec: number, playAfter: boolean) {
  if (!playAfter) {
    video.currentTime = sec;
    return;
  }
  video.addEventListener(
    "seeked",
    () => { safePlay(video); },
    { once: true },
  );
  video.currentTime = sec;
}

function timelineDuration(
  videoDuration: number,
  durationSec: number | null | undefined,
  markers: TimelineMarker[],
  anchor: number,
): number {
  if (videoDuration > 0) return videoDuration;
  if (durationSec && durationSec > 0) return durationSec;
  if (markers.length === 0) return 0;
  return Math.max(...markers.map((m) => tsToOffsetSec(m.ts, anchor)));
}

function buildTimelineMarkers(flags: ReplayFlag[], merged: MergedItem[]): TimelineMarker[] {
  const markers: TimelineMarker[] = flags.map((f) => ({
    id: `flag-${f.id}`,
    label: titleCase(f.type),
    ts: f.ts,
    vision: f.type.startsWith("vision_"),
  }));

  for (const item of merged) {
    if (item._kind !== "tool") continue;
    const flagType = FLAG_TOOL_TO_TYPE[item.name];
    if (flagType && flags.some((f) => f.type === flagType && f.ts === item.ts)) continue;
    markers.push({
      id: itemKey(item),
      label: TOOL_LABELS[item.name] ?? titleCase(item.name),
      ts: item.ts,
    });
  }

  return markers.sort((a, b) => new Date(a.ts).getTime() - new Date(b.ts).getTime());
}

function activeMarkerIdAtTime(markers: TimelineMarker[], anchor: number, currentSec: number): string | null {
  let active: string | null = null;
  for (const marker of markers) {
    if (tsToOffsetSec(marker.ts, anchor) <= currentSec) active = marker.id;
    else break;
  }
  return active;
}

const PLAYBACK_SPEEDS = [0.75, 1, 1.25, 1.5, 2] as const;

function ReplayControls({
  videoRef,
  shellRef,
  videoUrl,
  isPlaying,
  onTogglePlay,
  playbackSec,
  duration,
  playbackRate,
  onPlaybackRate,
}: {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  shellRef: React.RefObject<HTMLDivElement | null>;
  videoUrl: string;
  isPlaying: boolean;
  onTogglePlay: () => void;
  playbackSec: number;
  duration: number;
  playbackRate: number;
  onPlaybackRate: (rate: number) => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const pipSupported = typeof document !== "undefined" && document.pictureInPictureEnabled;
  const fsSupported = typeof document !== "undefined" && document.fullscreenEnabled;

  useEffect(() => {
    if (!menuOpen) return;
    function close(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    }
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [menuOpen]);

  useEffect(() => {
    function onFullscreenChange() {
      setIsFullscreen(document.fullscreenElement === shellRef.current);
    }
    document.addEventListener("fullscreenchange", onFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", onFullscreenChange);
  }, [shellRef]);

  const togglePiP = async () => {
    const video = videoRef.current;
    if (!video || !pipSupported) return;
    try {
      if (document.pictureInPictureElement === video) await document.exitPictureInPicture();
      else await video.requestPictureInPicture();
    } catch {
      /* user dismissed or unsupported */
    }
    setMenuOpen(false);
  };

  const toggleFullscreen = async () => {
    const shell = shellRef.current;
    if (!shell || !fsSupported) return;
    try {
      if (document.fullscreenElement === shell) await document.exitFullscreen();
      else await shell.requestFullscreen();
    } catch {
      /* user dismissed or unsupported */
    }
  };

  return (
    <div className="replay-controls">
      <button
        type="button"
        className="icon-btn replay-play-btn"
        onClick={onTogglePlay}
        aria-label={isPlaying ? "Pause" : "Play"}
      >
        {isPlaying ? (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
            <rect x="6" y="5" width="4" height="14" rx="1" />
            <rect x="14" y="5" width="4" height="14" rx="1" />
          </svg>
        ) : (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
            <path d="M8 5.14v13.72L19 12 8 5.14z" />
          </svg>
        )}
      </button>
      <span className="replay-controls-time mono">
        {fmtTimecode(playbackSec)}{duration > 0 ? ` / ${fmtTimecode(duration)}` : ""}
      </span>
      <div className="replay-controls-spacer" />
      {fsSupported && (
        <button
          type="button"
          className="icon-btn"
          onClick={() => { void toggleFullscreen(); }}
          aria-label={isFullscreen ? "Exit full screen" : "Full screen"}
        >
          {isFullscreen ? (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M8 3v3a2 2 0 0 1-2 2H3" />
              <path d="M21 8h-3a2 2 0 0 1-2-2V3" />
              <path d="M3 16h3a2 2 0 0 1 2 2v3" />
              <path d="M16 21v-3a2 2 0 0 1 2-2h3" />
            </svg>
          ) : (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M8 3H5a2 2 0 0 0-2 2v3" />
              <path d="M21 8V5a2 2 0 0 0-2-2h-3" />
              <path d="M3 16v3a2 2 0 0 0 2 2h3" />
              <path d="M16 21h3a2 2 0 0 0 2-2v-3" />
            </svg>
          )}
        </button>
      )}
      <div className="replay-menu" ref={menuRef}>
        <button
          type="button"
          className="icon-btn"
          aria-label="More video options"
          aria-expanded={menuOpen}
          aria-haspopup="menu"
          onClick={() => setMenuOpen((o) => !o)}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
            <circle cx="5" cy="12" r="1.75" />
            <circle cx="12" cy="12" r="1.75" />
            <circle cx="19" cy="12" r="1.75" />
          </svg>
        </button>
        {menuOpen && (
          <div className="replay-menu-panel" role="menu">
            {pipSupported && (
              <button type="button" className="replay-menu-item" role="menuitem" onClick={() => { void togglePiP(); }}>
                Picture-in-picture
              </button>
            )}
            <a
              href={videoUrl}
              download="interview-recording.mp4"
              className="replay-menu-item"
              role="menuitem"
              onClick={() => setMenuOpen(false)}
            >
              Download
            </a>
            <div className="replay-menu-divider" role="separator" />
            <div className="replay-menu-label">Playback speed</div>
            {PLAYBACK_SPEEDS.map((rate) => (
              <button
                key={rate}
                type="button"
                className={`replay-menu-item${playbackRate === rate ? " active" : ""}`}
                role="menuitemradio"
                aria-checked={playbackRate === rate}
                onClick={() => { onPlaybackRate(rate); setMenuOpen(false); }}
              >
                {rate === 1 ? "Normal (1×)" : `${rate}×`}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function FlagTimeline({
  markers,
  anchor,
  durationSec,
  videoDuration,
  playbackSec,
  onSeek,
}: {
  markers: TimelineMarker[];
  anchor: number;
  durationSec?: number | null;
  videoDuration: number;
  playbackSec: number;
  onSeek: (sec: number) => void;
}) {
  const duration = timelineDuration(videoDuration, durationSec, markers, anchor);
  const playPct = duration > 0 ? Math.min(100, (playbackSec / duration) * 100) : 0;
  const activeMarkerId = activeMarkerIdAtTime(markers, anchor, playbackSec);
  const [hoveredMarkerId, setHoveredMarkerId] = useState<string | null>(null);

  const isListHighlighted = (id: string) => activeMarkerId === id || hoveredMarkerId === id;

  const seekFromTrack = (e: React.MouseEvent<HTMLDivElement>) => {
    if (duration <= 0) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    onSeek(ratio * duration);
  };

  return (
    <div className="replay-flag-timeline">
      <div className="replay-flag-timeline-head">
        <span className="replay-video-label" style={{ padding: 0 }}>Flags</span>
      </div>
      {markers.length === 0 ? (
        <div className="replay-flag-empty muted">No behavioral flags raised.</div>
      ) : (
        <>
          <div
            className="replay-flag-track"
            role="slider"
            aria-valuemin={0}
            aria-valuemax={duration}
            aria-valuenow={playbackSec}
            aria-label="Interview timeline"
            tabIndex={0}
            onClick={seekFromTrack}
            onKeyDown={(e) => {
              if (duration <= 0) return;
              if (e.key === "ArrowLeft") { e.preventDefault(); onSeek(Math.max(0, playbackSec - 5)); }
              if (e.key === "ArrowRight") { e.preventDefault(); onSeek(Math.min(duration, playbackSec + 5)); }
            }}
          >
            {duration > 0 && <div className="replay-flag-playhead" style={{ left: `${playPct}%` }} />}
            {markers.map((marker) => {
              const offset = tsToOffsetSec(marker.ts, anchor);
              const pct = duration > 0 ? Math.min(100, Math.max(0, (offset / duration) * 100)) : 0;
              return (
                <button
                  key={marker.id}
                  type="button"
                  className={`replay-flag-marker${marker.vision ? " vision" : ""}`}
                  style={{ left: `${pct}%` }}
                  title={`${marker.label} · ${fmtTimecode(offset)}`}
                  aria-label={`${marker.label} at ${fmtTimecode(offset)}`}
                  onMouseEnter={() => setHoveredMarkerId(marker.id)}
                  onMouseLeave={() => setHoveredMarkerId(null)}
                  onClick={(e) => { e.stopPropagation(); onSeek(offset); }}
                />
              );
            })}
          </div>
          <ul className="replay-flag-list">
            {markers.map((marker) => {
              const offset = tsToOffsetSec(marker.ts, anchor);
              return (
                <li key={marker.id}>
                  <button
                    type="button"
                    className={`replay-flag-item${isListHighlighted(marker.id) ? " highlighted" : ""}`}
                    onMouseEnter={() => setHoveredMarkerId(marker.id)}
                    onMouseLeave={() => setHoveredMarkerId(null)}
                    onClick={() => onSeek(offset)}
                  >
                    <span className={`badge${marker.vision ? " amber" : ""}`}>{marker.label}</span>
                    <span className="mono muted">{fmtTimecode(offset)}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </div>
  );
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
  durationSec,
  flags = [],
}: {
  sessionId: string;
  videoUrl: string;
  expiresInSec?: number;
  transcript: { id: string; role: string; text: string; ts: string; interrupted?: boolean }[];
  toolEvents: { ts: string; payload?: { function_calls?: { name?: string; arguments?: unknown }[]; function_call_outputs?: unknown[] } }[];
  startedAt: string | null;
  durationSec?: number | null;
  flags?: ReplayFlag[];
}) {
  const merged = useMemo(() => mergeTranscript(transcript, toolEvents), [transcript, toolEvents]);
  const anchor = useMemo(() => anchorMs(startedAt, merged), [startedAt, merged]);
  const timelineMarkers = useMemo(() => buildTimelineMarkers(flags, merged), [flags, merged]);

  const videoRef = useRef<HTMLVideoElement>(null);
  const shellRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const rowRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const scrollLockUntil = useRef(0);
  const lastActiveRef = useRef<string | null>(null);
  const pendingSeek = useRef<{ time: number; play: boolean } | null>(null);

  const [videoUrl, setVideoUrl] = useState(initialVideoUrl);
  const [activeKey, setActiveKey] = useState<string | null>(null);
  const [videoDuration, setVideoDuration] = useState(0);
  const [playbackSec, setPlaybackSec] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1);

  const timelineLen = useMemo(
    () => timelineDuration(videoDuration, durationSec, timelineMarkers, anchor),
    [videoDuration, durationSec, timelineMarkers, anchor],
  );

  useEffect(() => {
    setVideoUrl(initialVideoUrl);
  }, [initialVideoUrl]);

  useEffect(() => {
    const video = videoRef.current;
    if (video) video.playbackRate = playbackRate;
  }, [playbackRate, videoUrl]);

  const togglePlay = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) safePlay(video);
    else video.pause();
  }, []);

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
    pendingSeek.current = null;
    seekVideo(video, pending.time, pending.play);
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
    setPlaybackSec(video.currentTime);
    setActiveKey(activeKeyAtTime(merged, anchor, video.currentTime));
  }, [merged, anchor]);

  const onVideoMetadata = useCallback(() => {
    const video = videoRef.current;
    if (!video || !Number.isFinite(video.duration)) return;
    setVideoDuration(video.duration);
  }, []);

  const seekToSec = useCallback((sec: number) => {
    const video = videoRef.current;
    if (!video) return;
    const wasPlaying = !video.paused;
    seekVideo(video, sec, wasPlaying);
    setPlaybackSec(sec);
    setActiveKey(activeKeyAtTime(merged, anchor, sec));
  }, [merged, anchor]);

  const seekToTurn = useCallback((item: Extract<MergedItem, { _kind: "turn" }>) => {
    const video = videoRef.current;
    if (!video) return;
    const index = merged.findIndex((m) => m._kind === "turn" && m.id === item.id);
    const sec = index >= 0 ? itemStartSec(merged, index, anchor) : tsToOffsetSec(item.ts, anchor);
    seekVideo(video, sec, true);
    setPlaybackSec(sec);
    setActiveKey(item.id);
  }, [merged, anchor]);

  if (merged.length === 0) return <div className="empty">No transcript.</div>;

  return (
    <div className="replay-split">
      <div className="replay-video-col">
        <div className="replay-video-label">Interview recording</div>
        <div className="replay-video-shell" ref={shellRef}>
          <video
            ref={videoRef}
            src={videoUrl}
            preload="auto"
            playsInline
            // @ts-expect-error fetchPriority is valid on video in modern browsers
            fetchPriority="high"
            className="replay-video"
            onTimeUpdate={onTimeUpdate}
            onLoadedMetadata={onVideoMetadata}
            onDurationChange={onVideoMetadata}
            onLoadedData={onVideoLoaded}
            onPlay={() => setIsPlaying(true)}
            onPause={() => setIsPlaying(false)}
          />
          <ReplayControls
            videoRef={videoRef}
            shellRef={shellRef}
            videoUrl={videoUrl}
            isPlaying={isPlaying}
            onTogglePlay={togglePlay}
            playbackSec={playbackSec}
            duration={timelineLen}
            playbackRate={playbackRate}
            onPlaybackRate={setPlaybackRate}
          />
        </div>
        <FlagTimeline
          markers={timelineMarkers}
          anchor={anchor}
          durationSec={durationSec}
          videoDuration={videoDuration}
          playbackSec={playbackSec}
          onSeek={seekToSec}
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
