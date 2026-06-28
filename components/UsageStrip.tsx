"use client";

import { useState, useRef } from "react";
import type { ModelUsageStat, TtsUsageStat, SttUsageStat } from "@/lib/data";
import { fmtTokens, fmtUsd } from "@/lib/cost";

function InfoIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="16" x2="12" y2="12" />
      <line x1="12" y1="8" x2="12.01" y2="8" />
    </svg>
  );
}

function Tooltip({ children, tip }: { children: React.ReactNode; tip: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  return (
    <div ref={ref} style={{ position: "relative", display: "inline-flex" }}
      onMouseEnter={() => setOpen(true)} onMouseLeave={() => setOpen(false)}>
      <span style={{ color: "var(--muted-2)", cursor: "default", display: "flex", alignItems: "center" }}>{children}</span>
      {open && (
        <div className="tip-box">
          {tip}
        </div>
      )}
    </div>
  );
}

function LlmTip({ models }: { models: ModelUsageStat[] }) {
  if (!models.length) return <span className="muted" style={{ fontSize: 12 }}>No data</span>;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {models.map((m) => (
        <div key={m.model}>
          <div style={{ fontFamily: "var(--mono)", fontSize: 11, color: "var(--muted-2)", marginBottom: 4 }}>{m.model}</div>
          <div className="tip-row"><span>Input</span><span>{fmtTokens(m.inputTokens)} × ${m.inputPricePerM}/1M</span></div>
          <div className="tip-row"><span>Output</span><span>{fmtTokens(m.outputTokens)} × ${m.outputPricePerM}/1M</span></div>
          <div className="tip-row tip-total"><span>Cost</span><span>{fmtUsd(m.costUsd)}</span></div>
        </div>
      ))}
    </div>
  );
}

function TtsTip({ models }: { models: TtsUsageStat[] }) {
  if (!models.length) return <span className="muted" style={{ fontSize: 12 }}>No data</span>;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {models.map((m) => (
        <div key={m.model}>
          <div style={{ fontFamily: "var(--mono)", fontSize: 11, color: "var(--muted-2)", marginBottom: 4 }}>{m.model}</div>
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
      <div style={{ fontFamily: "var(--mono)", fontSize: 11, color: "var(--muted-2)", marginBottom: 4 }}>whisper-1</div>
      <div className="tip-row"><span>Duration</span><span>{Math.round(stats.durationSec)}s ({(stats.durationSec / 60).toFixed(1)} min)</span></div>
      <div className="tip-row"><span>Rate</span><span>${stats.pricePerMin}/min</span></div>
      <div className="tip-row tip-total"><span>Cost</span><span>{fmtUsd(stats.costUsd)}</span></div>
    </div>
  );
}

function CostTip({ llm, tts, stt, total }: { llm: ModelUsageStat[]; tts: TtsUsageStat[]; stt: SttUsageStat; total: number }) {
  const llmCost = llm.reduce((s, m) => s + m.costUsd, 0);
  const ttsCost = tts.reduce((s, m) => s + m.costUsd, 0);
  return (
    <div>
      <div className="tip-row"><span>LLM</span><span>{fmtUsd(llmCost)}</span></div>
      <div className="tip-row"><span>TTS</span><span>{fmtUsd(ttsCost)}</span></div>
      <div className="tip-row"><span>STT</span><span>{fmtUsd(stt.costUsd)}</span></div>
      <div className="tip-row tip-total"><span>Total</span><span>{fmtUsd(total)}</span></div>
      <div style={{ fontSize: 11, color: "var(--muted-2)", marginTop: 8, borderTop: "1px solid var(--border)", paddingTop: 8 }}>
        Prices from llm-info. Estimates only.
      </div>
    </div>
  );
}

export default function UsageStrip({
  totalInputTokens, totalOutputTokens, totalTtsChars, totalSttSec, estimatedCostUsd,
  llmByModel, ttsByModel, sttStats,
}: {
  totalInputTokens: number; totalOutputTokens: number;
  totalTtsChars: number; totalSttSec: number; estimatedCostUsd: number;
  llmByModel: ModelUsageStat[]; ttsByModel: TtsUsageStat[]; sttStats: SttUsageStat;
}) {
  return (
    <div className="stats-strip" style={{ marginBottom: 18 }}>
      <div className="stat-tile">
        <div className="st-l" style={{ display: "flex", alignItems: "center", gap: 5 }}>
          LLM input
          <Tooltip tip={<LlmTip models={llmByModel} />}><InfoIcon /></Tooltip>
        </div>
        <div className="st-v">{fmtTokens(totalInputTokens)}</div>
      </div>
      <div className="stat-tile">
        <div className="st-l" style={{ display: "flex", alignItems: "center", gap: 5 }}>
          LLM output
          <Tooltip tip={<LlmTip models={llmByModel} />}><InfoIcon /></Tooltip>
        </div>
        <div className="st-v">{fmtTokens(totalOutputTokens)}</div>
      </div>
      <div className="stat-tile">
        <div className="st-l" style={{ display: "flex", alignItems: "center", gap: 5 }}>
          TTS chars
          <Tooltip tip={<TtsTip models={ttsByModel} />}><InfoIcon /></Tooltip>
        </div>
        <div className="st-v">{fmtTokens(totalTtsChars)}</div>
      </div>
      <div className="stat-tile">
        <div className="st-l" style={{ display: "flex", alignItems: "center", gap: 5 }}>
          STT seconds
          <Tooltip tip={<SttTip stats={sttStats} />}><InfoIcon /></Tooltip>
        </div>
        <div className="st-v">{Math.round(totalSttSec)}s</div>
      </div>
      <div className="stat-tile" style={{ gridColumn: "span 2" }}>
        <div className="st-l" style={{ display: "flex", alignItems: "center", gap: 5 }}>
          Estimated cost
          <Tooltip tip={<CostTip llm={llmByModel} tts={ttsByModel} stt={sttStats} total={estimatedCostUsd} />}><InfoIcon /></Tooltip>
        </div>
        <div className="st-v">{fmtUsd(estimatedCostUsd)}</div>
      </div>
    </div>
  );
}
