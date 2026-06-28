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

function Tooltip({ tip, children }: { tip: React.ReactNode; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ position: "relative", display: "inline-flex" }}
      onMouseEnter={() => setOpen(true)} onMouseLeave={() => setOpen(false)}>
      <span style={{ color: "var(--muted-2)", cursor: "default", display: "flex", alignItems: "center" }}>{children}</span>
      {open && <div className="tip-box">{tip}</div>}
    </div>
  );
}

function LlmTip({ models }: { models: ModelUsageStat[] }) {
  if (!models.length) return <span style={{ fontSize: 12, color: "rgba(255,255,255,.6)" }}>No data yet</span>;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {models.map((m) => (
        <div key={m.model}>
          <div style={{ fontFamily: "var(--mono)", fontSize: 11, color: "rgba(255,255,255,.5)", marginBottom: 4 }}>{m.model}</div>
          <div className="tip-row"><span>Input</span><span>{fmtTokens(m.inputTokens)} × ${m.inputPricePerM}/1M</span></div>
          <div className="tip-row"><span>Output</span><span>{fmtTokens(m.outputTokens)} × ${m.outputPricePerM}/1M</span></div>
          <div className="tip-row tip-total"><span>Cost</span><span>{fmtUsd(m.costUsd)}</span></div>
        </div>
      ))}
    </div>
  );
}

function TtsTip({ models }: { models: TtsUsageStat[] }) {
  if (!models.length) return <span style={{ fontSize: 12, color: "rgba(255,255,255,.6)" }}>No data yet</span>;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {models.map((m) => (
        <div key={m.model}>
          <div style={{ fontFamily: "var(--mono)", fontSize: 11, color: "rgba(255,255,255,.5)", marginBottom: 4 }}>{m.model}</div>
          <div className="tip-row"><span>Chars</span><span>{fmtTokens(m.chars)} × ${m.pricePerMChars}/1M</span></div>
          <div className="tip-row tip-total"><span>Cost</span><span>{fmtUsd(m.costUsd)}</span></div>
        </div>
      ))}
    </div>
  );
}

function SttTip({ stats }: { stats: SttUsageStat }) {
  return (
    <div>
      <div style={{ fontFamily: "var(--mono)", fontSize: 11, color: "rgba(255,255,255,.5)", marginBottom: 4 }}>deepgram/nova-3</div>
      <div className="tip-row"><span>Duration</span><span>{Math.round(stats.durationSec)}s ({(stats.durationSec / 60).toFixed(1)} min)</span></div>
      <div className="tip-row"><span>Rate</span><span>${stats.pricePerMin}/min</span></div>
      <div className="tip-row tip-total"><span>Cost</span><span>{fmtUsd(stats.costUsd)}</span></div>
    </div>
  );
}

function CostTip({ llm, tts, stt, total }: { llm: ModelUsageStat[]; tts: TtsUsageStat[]; stt: SttUsageStat; total: number }) {
  return (
    <div>
      <div className="tip-row"><span>LLM</span><span>{fmtUsd(llm.reduce((s, m) => s + m.costUsd, 0))}</span></div>
      <div className="tip-row"><span>TTS</span><span>{fmtUsd(tts.reduce((s, m) => s + m.costUsd, 0))}</span></div>
      <div className="tip-row"><span>STT</span><span>{fmtUsd(stt.costUsd)}</span></div>
      <div className="tip-row tip-total"><span>Total</span><span>{fmtUsd(total)}</span></div>
      <div style={{ fontSize: 11, color: "rgba(255,255,255,.4)", marginTop: 8, borderTop: "1px solid rgba(255,255,255,.1)", paddingTop: 8 }}>
        Prices from llm-info. Estimates only.
      </div>
    </div>
  );
}

function Label({ children, tip }: { children: string; tip?: React.ReactNode }) {
  return (
    <div className="st-l" style={{ display: "flex", alignItems: "center", gap: 5 }}>
      {children}
      {tip && <Tooltip tip={tip}><InfoIcon /></Tooltip>}
    </div>
  );
}

export default function DashboardStrip({
  total, completed, abandoned, withIssues, issueRate, avgDuration,
  totalInputTokens, totalOutputTokens, totalTtsChars, totalSttSec, estimatedCostUsd,
  llmByModel, ttsByModel, sttStats,
}: {
  total: number; completed: number; abandoned: number; withIssues: number;
  issueRate: string; avgDuration: string;
  totalInputTokens: number; totalOutputTokens: number;
  totalTtsChars: number; totalSttSec: number; estimatedCostUsd: number;
  llmByModel: ModelUsageStat[]; ttsByModel: TtsUsageStat[]; sttStats: SttUsageStat;
}) {
  return (
    <div className="stats-strip stats-strip-2row" style={{ marginBottom: 18 }}>
      {/* Row 1 — session stats */}
      <div className="stat-tile"><Label>Total</Label><div className="st-v">{total}</div></div>
      <div className="stat-tile"><Label>Completed</Label><div className="st-v">{completed}</div></div>
      <div className="stat-tile"><Label>Abandoned</Label><div className="st-v">{abandoned}</div></div>
      <div className="stat-tile"><Label>With issues</Label><div className="st-v">{withIssues}</div></div>
      <div className="stat-tile"><Label>Issue rate</Label><div className="st-v">{issueRate}</div></div>
      <div className="stat-tile"><Label>Avg duration</Label><div className="st-v">{avgDuration}</div></div>
      {/* Row 2 — usage + cost */}
      <div className="stat-tile stat-tile-r2">
        <Label tip={<LlmTip models={llmByModel} />}>LLM input</Label>
        <div className="st-v">{fmtTokens(totalInputTokens)}</div>
      </div>
      <div className="stat-tile stat-tile-r2">
        <Label tip={<LlmTip models={llmByModel} />}>LLM output</Label>
        <div className="st-v">{fmtTokens(totalOutputTokens)}</div>
      </div>
      <div className="stat-tile stat-tile-r2">
        <Label tip={<TtsTip models={ttsByModel} />}>TTS chars</Label>
        <div className="st-v">{fmtTokens(totalTtsChars)}</div>
      </div>
      <div className="stat-tile stat-tile-r2">
        <Label tip={<SttTip stats={sttStats} />}>STT seconds</Label>
        <div className="st-v">{Math.round(totalSttSec)}s</div>
      </div>
      <div className="stat-tile stat-tile-r2" style={{ gridColumn: "span 2", borderRight: 0 }}>
        <Label tip={<CostTip llm={llmByModel} tts={ttsByModel} stt={sttStats} total={estimatedCostUsd} />}>Estimated cost</Label>
        <div className="st-v">{fmtUsd(estimatedCostUsd)}</div>
      </div>
    </div>
  );
}
