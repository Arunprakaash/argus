import { ModelInfoMap } from "llm-info";

// Hardcoded TTS/STT prices (OpenAI, rarely changes)
const TTS_PRICE_PER_CHAR = 15 / 1_000_000;       // tts-1: $15/1M chars
const TTS_HD_PRICE_PER_CHAR = 30 / 1_000_000;    // tts-1-hd: $30/1M chars
const STT_PRICE_PER_SEC = 0.006 / 60;            // whisper-1: $0.006/min

export function llmCostUsd(model: string, inputTokens: number, outputTokens: number): number {
  const info = (ModelInfoMap as Record<string, any>)[model];
  if (!info?.pricePerMillionInputTokens) return 0;
  return (
    (inputTokens * info.pricePerMillionInputTokens) / 1_000_000 +
    (outputTokens * info.pricePerMillionOutputTokens) / 1_000_000
  );
}

export function ttsCostUsd(model: string, chars: number): number {
  const isHd = model?.includes("hd");
  return chars * (isHd ? TTS_HD_PRICE_PER_CHAR : TTS_PRICE_PER_CHAR);
}

export function sttCostUsd(durationSec: number): number {
  return durationSec * STT_PRICE_PER_SEC;
}

export function fmtUsd(n: number): string {
  if (n < 0.01) return `$${n.toFixed(4)}`;
  return `$${n.toFixed(2)}`;
}

export function fmtTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
}
