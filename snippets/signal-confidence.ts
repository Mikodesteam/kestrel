// Excerpt from Kestrel (server/src/signals/parser.ts). Shown for illustration only.
// The full source code is available at https://store.mikodes.com/p/kestrel/
//
// Scores a trading signal read from free text. The parser never guesses: missing parts, recap
// posts ("hit TP1") and numbers that contradict the side all lower the confidence, and the bot
// only acts on a signal at or above a threshold.

import { Decimal } from 'decimal.js';

export interface ParsedSignal {
  symbol: string | null;
  base: string | null;
  quote: string | null;
  side: 'long' | 'short' | null;
  entries: string[];
  targets: string[];
  stopLoss: string | null;
  leverage: number | null;
  confidence: number;
}

// …
/**
 * Reads a trading signal from free text (Telegram channel posts, TradingView text alerts).
 * Never guesses: anything it is unsure about lowers `confidence`; the bot trades only at ≥ 0.5.
 */
export function parseSignal(input: string): ParsedSignal {
  // … symbol, side, entries, targets and stop-loss are read here …

  let conf = 0;
  if (res.symbol) conf += 0.2;
  if (res.side) conf += 0.2;
  if (res.entries.length || /\bmarket\b|\bcmp\b|\bnow\b/i.test(text)) conf += 0.2;
  if (res.targets.length) conf += 0.2;
  if (res.stopLoss) conf += 0.15;
  if (!res.targets.length && !res.stopLoss) conf = Math.min(conf, 0.45); // a call without exits is not a signal
  if (negated) conf -= 0.5;
  // Results and recap posts ("hit TP1 +45%") describe the past.
  if (/\b(hit|reached|achieved|smashed|booked|results?)\b|[+]\s?\d+(\.\d+)?\s?%/i.test(input)) conf -= 0.4;
  // Numbers that contradict the side mean we misread something.
  if (res.side) {
    const long = res.side === 'long';
    const lo = res.entries.length ? Decimal.min(...res.entries) : null,
      hi = res.entries.length ? Decimal.max(...res.entries) : null;
    const badTp = hi && lo && res.targets.some((t) => (long ? new Decimal(t).lte(hi) : new Decimal(t).gte(lo)));
    const badSl =
      hi && lo && res.stopLoss && (long ? new Decimal(res.stopLoss).gte(lo) : new Decimal(res.stopLoss).lte(hi));
    const badPair =
      res.stopLoss &&
      res.targets.some((t) => (long ? new Decimal(t).lte(res.stopLoss!) : new Decimal(t).gte(res.stopLoss!)));
    if (badTp || badSl || badPair) conf -= 0.5;
  }
  res.confidence = Math.max(0, Math.round(conf * 100) / 100);
  return res;
}
