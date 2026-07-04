"use client";

import { useState } from "react";
import type { ModelUsageStat, TtsUsageStat, SttUsageStat } from "@/lib/data";
import { fmtTokens, fmtUsd } from "@/lib/cost";

function InfoIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
      <circle cx="12" cy="12" r="10" /><line x1="12" y1="16" x2="12" y2="12" /><line x1="12" y1="8" x2="12.01" y2="8" />
    </svg>
  );
}

function Tooltip({ tip, children, align = "start" }: { tip: React.ReactNode; children: React.ReactNode; align?: "start" | "end" }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ position: "relative", display: "inline-flex" }}
      onMouseEnter={() => setOpen(true)} onMouseLeave={() => setOpen(false)}>
      <span style={{ color: "var(--muted-2)", cursor: "default", display: "flex", alignItems: "center" }}>{children}</span>
      {open && <div className={`tip-box${align === "end" ? " tip-box-end" : ""}`}>{tip}</div>}
    </div>
  );
}

function CostTip({ llm, tts, stt, total }: { llm: ModelUsageStat[]; tts: TtsUsageStat[]; stt: SttUsageStat; total: number }) {
  const llmIn = llm.reduce((s, m) => s + m.inputTokens, 0);
  const llmOut = llm.reduce((s, m) => s + m.outputTokens, 0);
  const ttsChars = tts.reduce((s, m) => s + m.chars, 0);
  const llmCost = llm.reduce((s, m) => s + m.costUsd, 0);
  const ttsCost = tts.reduce((s, m) => s + m.costUsd, 0);

  return (
    <div>
      <div className="tip-row"><span>LLM in</span><span>{fmtTokens(llmIn)} tokens</span></div>
      <div className="tip-row"><span>LLM out</span><span>{fmtTokens(llmOut)} tokens</span></div>
      <div className="tip-row"><span>TTS</span><span>{fmtTokens(ttsChars)} chars</span></div>
      <div className="tip-row"><span>STT</span><span>{Math.round(stt.durationSec)}s</span></div>
      <div style={{ borderTop: "1px solid rgba(255,255,255,.15)", margin: "8px 0" }} />
      <div className="tip-row"><span>LLM</span><span>{fmtUsd(llmCost)}</span></div>
      <div className="tip-row"><span>TTS</span><span>{fmtUsd(ttsCost)}</span></div>
      <div className="tip-row"><span>STT</span><span>{fmtUsd(stt.costUsd)}</span></div>
      <div className="tip-row tip-total"><span>Total</span><span>{fmtUsd(total)}</span></div>
    </div>
  );
}

function Label({ children, tip, tipAlign }: { children: string; tip?: React.ReactNode; tipAlign?: "start" | "end" }) {
  return (
    <div className="st-l" style={{ display: "flex", alignItems: "center", gap: 5 }}>
      {children}
      {tip && <Tooltip tip={tip} align={tipAlign}><InfoIcon /></Tooltip>}
    </div>
  );
}

export default function DashboardStrip({
  total, completed, abandoned, withIssues, avgDuration,
  estimatedCostUsd, llmByModel, ttsByModel, sttStats,
}: {
  total: number; completed: number; abandoned: number; withIssues: number;
  avgDuration: string; estimatedCostUsd: number;
  llmByModel: ModelUsageStat[]; ttsByModel: TtsUsageStat[]; sttStats: SttUsageStat;
}) {
  return (
    <div className="stats-strip" style={{ marginBottom: 18 }}>
      <div className="stat-tile"><Label>Total</Label><div className="st-v">{total}</div></div>
      <div className="stat-tile"><Label>Completed</Label><div className="st-v">{completed}</div></div>
      <div className="stat-tile"><Label>Abandoned</Label><div className="st-v">{abandoned}</div></div>
      <div className="stat-tile"><Label>With issues</Label><div className="st-v">{withIssues}</div></div>
      <div className="stat-tile"><Label>Avg duration</Label><div className="st-v">{avgDuration}</div></div>
      <div className="stat-tile">
        <Label tip={<CostTip llm={llmByModel} tts={ttsByModel} stt={sttStats} total={estimatedCostUsd} />} tipAlign="end">Estimated cost</Label>
        <div className="st-v">{fmtUsd(estimatedCostUsd)}</div>
      </div>
    </div>
  );
}
